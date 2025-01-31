const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { Configuration, OpenAIApi } = require('openai');
const admin = require('firebase-admin');
const fetch = require('node-fetch'); // Para chamar o /api/tts internamente
const textToSpeech = require('@google-cloud/text-to-speech');

// Agora as variáveis de ambiente do .env serão carregadas corretamente

// Instancia o cliente de Text-to-Speech
const ttsClient = new textToSpeech.TextToSpeechClient();

// 🔹 Verifica se a variável FIREBASE_SERVICE_ACCOUNT foi carregada corretamente
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ ERRO: Variável de ambiente FIREBASE_SERVICE_ACCOUNT não encontrada!");
  process.exit(1); // Encerra o servidor para evitar erros
}

// 🔹 Converte a string JSON do .env para um objeto válido do Firebase
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log("✅ Chave de serviço Firebase carregada corretamente.");
} catch (error) {
  console.error("❌ ERRO ao analisar FIREBASE_SERVICE_ACCOUNT:", error.message);
  process.exit(1);
}

// 🔹 Inicializa o Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
  console.log("✅ Firebase inicializado com sucesso!");
} catch (error) {
  console.error("❌ ERRO ao inicializar o Firebase:", error.message);
  process.exit(1);
}

const db = admin.database(); // Inicializa o banco de dados Firebase
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Armazena o histórico das conversas na memória do servidor
const conversations = {};

// Função para criar o contexto inicial
function createInitialContext(studentName, studentLevel, studentUnit, conversationDetails, conversationFullContent) {
  return {
    role: "system",
    content: `
You are Samuel, a friendly, patient, and motivating virtual robot.
Help ${studentName} practice English, always addressing him/her by name.
They are at ${studentLevel} level.
Keep the conversation centered on ${conversationFullContent}.
Start by saying: "Let's begin the lesson, ${studentName}!" and begin the class.
After covering all of ${conversationFullContent}, thank, congratulate, and say goodbye, affirming that he/she is ready for the next stage. Then, stop interacting. If the student insists, politely refuse and ask to go to the next class and say: press the black button to go back
Adapt the language according to the level (CEFR):
Level 0: they are little children. max. 1-2 very simple sentences.
Level 1 (A1): max. 3 short sentences.
Level 2 (A2): max. 3 simple sentences.
Level 3 (B1): max. 4 simple sentences.
Level 4 (B2): slightly longer but clear sentences.

Interaction Tips:
Keep responses short and to the point. Avoid being verbose.
If the student speaks another language, gently ask them to use English.
Praise correct answers. If there’s a mistake, ask them to try again once. If the error persists, provide the correct form, encourage them (“Good try! You’re improving!”), and move on.
Use text only (no emojis).
Maintain a positive, light, and productive tone.
`,
  };
}

// Função para carregar o tópico e conteúdo do arquivo conversa.txt
function loadConversationDetails(level, unit) {
  const filePath = path.join(__dirname, '..', level, unit, 'DataIA', 'conversa.txt');
  console.log(`📂 Tentando acessar o arquivo: ${filePath}`);
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
    console.log("✅ Arquivo conversa.txt carregado com sucesso.");
    // Divide o conteúdo em linhas e remove linhas vazias
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    // Usa a primeira linha como tópico (se existir)
    const topic = lines.length > 0 ? lines[0].trim() : 'General conversation';
    // Sanitiza o conteúdo completo, removendo ### e numeração
    const sanitizedContent = fileContent.replace(/###|\d+\.\s/g, '').trim();
    return { topic, fullContent: sanitizedContent };
  } else {
    console.warn(`⚠️ Arquivo conversa.txt não encontrado: ${filePath}. Usando 'General conversation'.`);
    return { topic: 'General conversation', fullContent: '' };
  }
}

// Função para validar e limpar o histórico de mensagens
function validateAndTrimHistory(userId) {
  if (!Array.isArray(conversations[userId])) {
    conversations[userId] = [];
  }
  conversations[userId] = conversations[userId].filter(message => {
    return message && typeof message.role === 'string' && typeof message.content === 'string';
  });
  // Agora, o histórico máximo passa a ser 10
  if (conversations[userId].length > 10) {
    conversations[userId] = conversations[userId].slice(-10);
  }
}

// NOVO ENDPOINT /api/tts (Gera áudio Base64 a partir de texto usando Google Cloud TTS)
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required." });
    }

    // Configuração da requisição para Google Cloud TTS
    const request = {
      input: { text },
      voice: {
        languageCode: "en-US",
        name: "en-US-Standard-D", // Voz masculina, neutra e econômica
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioBase64 = response.audioContent.toString('base64');

    return res.json({ audioBase64 });
  } catch (error) {
    console.error("❌ Erro ao gerar áudio no Google TTS:", error);
    return res.status(500).json({ error: "Erro ao gerar áudio com Google TTS." });
  }
});

// Endpoint /api/start
app.get('/api/start', async (req, res) => {
  try {
    const userId = req.query.uid;
    const studentLevel = req.query.level || "Level1"; // Corrigido para incluir "Level" no valor padrão
    const studentUnit = req.query.unit || "Unit1"; // Corrigido para incluir "Unit" no valor padrão

    console.log("✅ Request recebido com os seguintes parâmetros:", { userId, studentLevel, studentUnit });

    if (!userId) {
      console.error("❌ User ID está ausente.");
      return res.status(400).json({ error: "User ID is required." });
    }

    // Carrega dados do arquivo conversa.txt
    let conversationDetails = 'General conversation';
    let conversationFullContent = '';
    const filePath = path.join(__dirname, '..', studentLevel, studentUnit, 'DataIA', 'conversa.txt');
    console.log(`📂 Tentando acessar o arquivo: ${filePath}`);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
      console.log("✅ Arquivo conversa.txt carregado com sucesso.");
      const lines = fileContent.split('\n');
      if (lines.length > 0) {
        conversationDetails = lines[0].trim();
        conversationFullContent = fileContent;
        console.log(`📝 Tópico extraído: "${conversationDetails}"`);
      } else {
        console.warn("⚠️ O arquivo conversa.txt está vazio. Usando 'General conversation'.");
      }
    } else {
      console.warn(`⚠️ Arquivo conversa.txt não encontrado: ${filePath}. Usando 'General conversation'.`);
    }

    // Recupera o nome do aluno no Firebase
    const userRef = db.ref(`usuarios/${userId}/nome`);
    const snapshot = await userRef.once('value');
    if (!snapshot.exists()) {
      console.error(`❌ Usuário não encontrado no Firebase para userId=${userId}.`);
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    const studentName = snapshot.val();
    console.log(`✅ Nome do usuário recuperado: ${studentName}`);

    // Cria o contexto inicial (IMPORTANTE: passar 5º parâmetro)
    const contextMessage = createInitialContext(
      studentName,
      studentLevel,
      studentUnit,
      conversationDetails,
      conversationFullContent
    );

    // Mensagem inicial
    const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

    // (Re)cria o array de conversas para evitar cache
    conversations[userId] = [
      { studentName, studentLevel, studentUnit },
      contextMessage,
      { role: "assistant", content: initialMessage },
    ];
    console.log(`📝 Contexto inicial (re)inicializado para userId=${userId}`);

    // Valida e limpa o histórico
    validateAndTrimHistory(userId);

    // Gera o áudio referente à mensagem inicial chamando o próprio endpoint /api/tts
    let audioBase64 = null;
    try {
      const ttsResponse = await fetch(`http://localhost:${PORT}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: initialMessage }),
      });
      const ttsData = await ttsResponse.json();
      audioBase64 = ttsData.audioBase64;
    } catch (error) {
      console.error("❌ Erro ao obter áudio da mensagem inicial:", error);
    }

    return res.json({
      response: initialMessage,
      audio: audioBase64, // Retornamos o áudio em Base64
      studentInfo: {
        name: studentName,
        level: studentLevel,
        unit: studentUnit,
        fullContent: conversationFullContent,
      },
      chatHistory: conversations[userId],
    });
  } catch (error) {
    console.error(`❌ Erro ao inicializar a conversa: ${error.message}`);
    return res.status(500).json({ error: "Erro ao inicializar a conversa.", details: error.message });
  }
});

// Endpoint POST /api/chat para interagir com a IA
app.post('/api/chat', async (req, res) => {
  const userId = req.body.uid;
  const userMessage = req.body.message;

  console.log(`🔍 Requisição recebida para interação com a IA. userId=${userId}, mensagem="${userMessage}"`);

  // Valida os parâmetros recebidos
  if (typeof userId !== 'string' || !userId.trim() || typeof userMessage !== 'string' || !userMessage.trim()) {
    console.error("❌ Parâmetros ausentes ou inválidos: User ID ou mensagem estão faltando.");
    return res.status(400).json({ response: "User ID and message are required and must be valid strings." });
  }

  try {
    // Se não houver contexto ainda, cria um novo
    if (!conversations[userId]) {
      console.warn(`⚠️ Contexto ausente para userId=${userId}. Criando um novo contexto.`);
      const userRef = db.ref(`usuarios/${userId}/nome`);
      const snapshot = await userRef.once('value');
      let studentName = "Student";
      if (snapshot.exists()) {
        studentName = snapshot.val();
        console.log(`✅ Nome do usuário recuperado do Firebase para userId=${userId}: ${studentName}`);
      }
      const studentLevel = req.body.level || "Level1";
      const studentUnit = req.body.unit || "Unit1";
      const { topic: conversationDetails, fullContent: conversationFullContent } =
        loadConversationDetails(studentLevel, studentUnit);

      // Cria o contexto inicial com os dados
      const contextMessage = createInitialContext(
        studentName,
        studentLevel,
        studentUnit,
        conversationDetails,
        conversationFullContent
      );

      // Inicia a conversa
      conversations[userId] = [contextMessage];
    }

    // Valida e limpa o histórico antes de adicionar nova mensagem
    validateAndTrimHistory(userId);

    // Adiciona a mensagem do usuário ao histórico
    conversations[userId].push({ role: 'user', content: userMessage });

    // Chama a OpenAI com o histórico atualizado
    const completion = await openai.createChatCompletion({
      model: 'gpt-4o-mini-2024-07-18', // Certifique-se de que este modelo exista na sua conta
      messages: conversations[userId],
    });

    const responseMessage = completion.data.choices[0].message.content;

    // Obtém o áudio correspondente via /api/tts
    let audioBase64 = null;
    try {
      const ttsResponse = await fetch(`http://localhost:${PORT}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: responseMessage }),
      });
      const ttsData = await ttsResponse.json();
      audioBase64 = ttsData.audioBase64;
    } catch (error) {
      console.error("❌ Erro ao obter áudio da resposta da IA:", error);
    }

    // Adiciona a resposta da IA ao histórico
    conversations[userId].push({ role: 'assistant', content: responseMessage });

    // Retorna a resposta e o áudio
    res.json({
      text: responseMessage,
      audio: audioBase64,
      chatHistory: conversations[userId],
    });
  } catch (error) {
    console.error(`❌ Erro durante a interação com a IA para userId=${userId}: ${error.message}`);
    res.status(500).json({ response: "Erro ao processar a mensagem.", details: error.message });
  }
});

// Rota raiz para ver se está tudo ok
app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

// Inicializa o servidor
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

// Exporta o app para uso em testes ou outros módulos
module.exports = app;
