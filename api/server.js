const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const admin = require('firebase-admin');

// ======================
//  IMPORT E CONFIG TTS
// ======================
const textToSpeech = require('@google-cloud/text-to-speech');

// Lê as credenciais do Google TTS da variável de ambiente
console.log("GOOGLE_TTS_SERVICE_ACCOUNT:", process.env.GOOGLE_TTS_SERVICE_ACCOUNT ? "DEFINIDO" : "NÃO DEFINIDO");
const ttsCredentials = JSON.parse(process.env.GOOGLE_TTS_SERVICE_ACCOUNT || '{}');

// Cria o cliente de TTS usando as credenciais vindas do ambiente
const ttsClient = new textToSpeech.TextToSpeechClient({
    credentials: ttsCredentials,
});

// ===================================
//  CONFIGURAÇÃO FIREBASE ADMIN
// ===================================
console.log("FIREBASE_SERVICE_ACCOUNT:", process.env.FIREBASE_SERVICE_ACCOUNT || "NÃO DEFINIDO"); // Verifica o valor da variável de ambiente

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
    console.log("Firebase inicializado com sucesso!");
} catch (error) {
    console.error("Erro ao inicializar o Firebase:", error.message);
}

const db = admin.database(); // Inicializa o banco de dados Firebase

// ===================================
//  CONFIGURAÇÃO DO EXPRESS
// ===================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// ===================================
//  CONFIGURAÇÃO OPENAI
// ===================================
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// ===================================
//  ARMAZENAMENTO EM MEMÓRIA
// ===================================
const conversations = {};

// ===================================
//  FUNÇÕES AUXILIARES
// ===================================

// Cria o contexto inicial para a conversa
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
`
    };
}

// Lê o arquivo conversa.txt para recuperar o tópico e conteúdo
function loadConversationDetails(level, unit) {
    const filePath = path.join(__dirname, '..', level, unit, 'DataIA', 'conversa.txt');
    console.log(`📂 Tentando acessar o arquivo: ${filePath}`);

    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
        console.log("✅ Arquivo conversa.txt carregado com sucesso.");

        // Divide por linhas, removendo as vazias
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');

        // Primeira linha como tópico
        const topic = lines.length > 0 ? lines[0].trim() : 'General conversation';

        // Remove "###" e numerações do conteúdo
        const sanitizedContent = fileContent.replace(/###|\d+\.\s/g, '').trim();

        return { topic, fullContent: sanitizedContent };
    } else {
        console.warn(`⚠️ Arquivo conversa.txt não encontrado: ${filePath}. Usando 'General conversation'.`);
        return { topic: 'General conversation', fullContent: '' };
    }
}

// Valida e limpa o histórico de mensagens para não passar de 10
function validateAndTrimHistory(userId) {
    if (!Array.isArray(conversations[userId])) {
        conversations[userId] = [];
    }

    conversations[userId] = conversations[userId].filter(message => {
        return message && typeof message.role === 'string' && typeof message.content === 'string';
    });

    if (conversations[userId].length > 10) {
        conversations[userId] = conversations[userId].slice(-10);
    }
}

// ===================================
//  ENDPOINT /api/start (GET)
// ===================================
app.get('/api/start', async (req, res) => {
    try {
        const userId = req.query.uid;
        const studentLevel = req.query.level || "Level1"; 
        const studentUnit = req.query.unit || "Unit1";   

        console.log("✅ Request recebido em /api/start com parâmetros:", { userId, studentLevel, studentUnit });

        if (!userId) {
            console.error("❌ User ID está ausente.");
            return res.status(400).json({ error: "User ID is required." });
        }

        // Tenta carregar dados do arquivo conversa.txt
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

        // Cria o contexto inicial
        const contextMessage = createInitialContext(
            studentName,
            studentLevel,
            studentUnit,
            conversationDetails,
            conversationFullContent
        );

        // Mensagem inicial
        const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

        // (Re)inicializa o array de conversas
        conversations[userId] = [
            { studentName, studentLevel, studentUnit },
            contextMessage,
            { role: "assistant", content: initialMessage },
        ];
        console.log(`📝 Contexto inicial (re)inicializado para userId=${userId}`);

        // Valida e limpa o histórico
        validateAndTrimHistory(userId);

        return res.json({
            response: initialMessage,
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

// ===================================
//  ENDPOINT /api/chat (POST)
// ===================================
app.post('/api/chat', async (req, res) => {
    const userId = req.body.uid;
    const userMessage = req.body.message;

    console.log(`🔍 Requisição recebida em /api/chat. userId=${userId}, mensagem="${userMessage}"`);

    // Valida os parâmetros recebidos
    if (typeof userId !== 'string' || !userId.trim() || typeof userMessage !== 'string' || !userMessage.trim()) {
        console.error("❌ Parâmetros ausentes ou inválidos: User ID ou mensagem estão faltando.");
        return res.status(400).json({ response: "User ID and message are required and must be valid strings." });
    }

    try {
        // Se não existir contexto, cria um novo (caso /api/chat seja chamado antes de /api/start)
        if (!conversations[userId]) {
            console.warn(`⚠️ Contexto ausente para userId=${userId}. Criando um novo contexto.`);

            // Pega o nome do usuário
            const userRef = db.ref(`usuarios/${userId}/nome`);
            const snapshot = await userRef.once('value');
            let studentName = "Student";

            if (snapshot.exists()) {
                studentName = snapshot.val();
                console.log(`✅ Nome do usuário recuperado do Firebase: ${studentName}`);
            }

            const studentLevel = req.body.level || "Level1";
            const studentUnit = req.body.unit || "Unit1";
            const { topic: conversationDetails, fullContent: conversationFullContent } =
                loadConversationDetails(studentLevel, studentUnit);

            // Cria contexto inicial
            const contextMessage = createInitialContext(
                studentName,
                studentLevel,
                studentUnit,
                conversationDetails,
                conversationFullContent
            );

            conversations[userId] = [contextMessage];
        }

        // Valida e limpa o histórico
        validateAndTrimHistory(userId);

        // Adiciona a mensagem do usuário
        conversations[userId].push({ role: 'user', content: userMessage });

        // Chama a OpenAI com o histórico atualizado
        const completion = await openai.createChatCompletion({
            model: 'gpt-4o-mini-2024-07-18', // Certifique-se de que este modelo exista na sua conta
            messages: conversations[userId],
        });

        const responseMessage = completion.data.choices[0].message.content;

        // Adiciona a resposta da IA ao histórico
        conversations[userId].push({ role: 'assistant', content: responseMessage });

        // Retorna a resposta
        res.json({ response: responseMessage, chatHistory: conversations[userId] });
    } catch (error) {
        console.error(`❌ Erro durante a interação com a IA para userId=${userId}: ${error.message}`);
        res.status(500).json({ response: "Erro ao processar a mensagem.", details: error.message });
    }
});

// ===================================
//  ENDPOINT /api/tts (POST) - GOOGLE TTS
// ===================================
app.post('/api/tts', async (req, res) => {
    try {
        const { text, speakingRate } = req.body;
        console.log("[/api/tts] Texto recebido para TTS:", text, "speakingRate:", speakingRate);

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: "Texto inválido ou ausente." });
        }

        const request = {
            input: { text },
            voice: {
                languageCode: 'en-US',
                name: 'en-US-Standard-J', // Define a voz específica
                ssmlGender: 'MALE' // 'J' é uma voz masculina
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: speakingRate || 1.0
            },
        };

        console.log("[/api/tts] Enviando request para Google TTS:", request);

        const [response] = await ttsClient.synthesizeSpeech(request);
        console.log("[/api/tts] Resposta do Google TTS recebida com sucesso.");

        // Convertemos o Buffer em base64 (caso venha como buffer)
        const audioContent = response.audioContent ? response.audioContent.toString('base64') : null;
        if (!audioContent) {
            console.error("[/api/tts] A resposta do TTS não contém 'audioContent'.");
            return res.status(500).json({ error: "Falha ao gerar o áudio." });
        }

        // Retornamos o base64 para o front-end
        return res.json({ audioContent });
    } catch (error) {
        console.error("[/api/tts] Erro ao processar TTS:", error);
        return res.status(500).json({ error: "Erro ao gerar áudio TTS.", details: error.message });
    }
});

// ===================================
//  ROTA RAIZ - TESTE
// ===================================
app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

// ===================================
//  INICIALIZA O SERVIDOR
// ===================================
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

// ===================================
//  EXPORT (caso precise em outro lugar)
// ===================================
module.exports = app;
