const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const admin = require('firebase-admin');

// Configuração Firebase Admin
console.log("FIREBASE_SERVICE_ACCOUNT:", process.env.FIREBASE_SERVICE_ACCOUNT || "NÃO DEFINIDO");
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = admin.database();

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
function createInitialContext(studentName, studentLevel, studentUnit, conversationDetails) {
    return {
      role: "system",
  content: `
                    You are Samuel, a friendly, patient, and motivating virtual robot friend. 
                `,
            };
}

// Atualização no endpoint /api/start para validar e limpar o histórico
app.get('/api/start', async (req, res) => {
    try {
        const userId = req.query.uid;
        const studentLevel = req.query.level || "1";
        const studentUnit = req.query.unit || "1";

        console.log("✅ Request recebido com os seguintes parâmetros:", { userId, studentLevel, studentUnit });

        if (!userId) {
            console.error("❌ User ID está ausente.");
            return res.status(400).json({ error: "User ID is required." });
        }

        let conversationDetails = 'General conversation';
        let conversationFullContent = '';

        // Caminho do arquivo conversa.txt
        const filePath = path.join(__dirname, '..', `Level${studentLevel}`, `Unit${studentUnit}`, 'DataIA', 'conversa.txt');
        console.log(`📂 Tentando acessar o arquivo: ${filePath}`);

        // Verifica se o arquivo existe e carrega o conteúdo
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
        const contextMessage = createInitialContext(studentName, studentLevel, studentUnit, conversationDetails);

        // Mensagem inicial
        const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

        // Salva ou atualiza o contexto no histórico
        if (!conversations[userId]) {
            conversations[userId] = [
                { studentName, studentLevel, studentUnit },
                contextMessage,
                { role: "assistant", content: initialMessage },
            ];
            console.log(`📝 Contexto inicial salvo para userId=${userId}`);
        } else {
            conversations[userId].unshift(contextMessage);
        }

        // Valida e limpa o histórico
        validateAndTrimHistory(userId);

        // Retorna a resposta e o histórico
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

// Função para validar e limpar o histórico de mensagens
function validateAndTrimHistory(userId) {
    // Certifica-se de que o histórico existe e é um array
    if (!Array.isArray(conversations[userId])) {
        conversations[userId] = [];
    }

    // Filtra mensagens inválidas (sem role ou content)
    conversations[userId] = conversations[userId].filter(message => {
        return message && typeof message.role === 'string' && typeof message.content === 'string';
    });

    // Limita o histórico a no máximo 20 mensagens
    if (conversations[userId].length > 20) {
        conversations[userId] = conversations[userId].slice(-20);
    }
}

// Atualização no endpoint /api/chat para validar e limpar o histórico
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
        // Inicializa o contexto se não existir
        if (!conversations[userId]) {
            console.warn(`⚠️ Contexto ausente para userId=${userId}. Criando um novo contexto.`);

            // Recupera os dados do aluno, se disponíveis
            const userRef = db.ref(`usuarios/${userId}/nome`);
            const snapshot = await userRef.once('value');

            let studentName = "Student"; // Nome genérico
            if (snapshot.exists()) {
                studentName = snapshot.val();
                console.log(`✅ Nome do usuário recuperado do Firebase para userId=${userId}: ${studentName}`);
            }

            // Definições padrão de nível, unidade e conteúdo
            const studentLevel = "Level1"; // Nível genérico
            const studentUnit = "Unit1";  // Unidade genérica
            let conversationDetails = "General conversation"; // Tópico genérico
            let conversationFullContent = ""; // Conteúdo genérico

            // Cria o contexto inicial com os dados
            const contextMessage = {
                role: "system",
                 content: `
                    You are Samuel, a friendly, patient, and motivating virtual robot friend. 
Your goal is to help ${studentName} practice English. Always address them by their name. 
They are currently at ${studentLevel}. Today's lesson topic is "${conversationDetails}". Begin the first speech by saying 'let's begin
(student's name) the lesson!' and begin the lesson promptly.

   Adapt your language to the student's level:
        - If the level is Level 1, it means that the student's English level in the CEFR is A1. Use short sentences (maximum of 3 per interaction), simple, clear and direct. Do not be verbose.
        - If the level is Level 2, it means that the student's English level in the CEFR is A2. Use short sentences (maximum of 3 per interaction), keeping them simple and clear. Do not be verbose.
        - If the level is Level 3, it means that the student's English level in the CEFR is B1. Use short sentences (maximum of 4 per interaction). Avoid being verbose.
        - If the level is Level 4, it means that the student's English level in the CEFR is B2. Avoid being verbose.

Focus on the topic and keep it engaging:
- Keep the conversation centered on "${conversationDetails}".
- Politely ask the student to speak English if they switch to another language.
- Praise correct answers and offer constructive feedback on mistakes.

Maintain a positive, light, and productive learning tone.

Additional information about the lesson:
${conversationFullContent}
                `,
            };
            conversations[userId] = [contextMessage];
        }

        // Valida e limpa o histórico antes de adicionar nova mensagem
       validateAndTrimHistory(userId);

        // Adiciona a mensagem do usuário ao histórico
        conversations[userId].push({ role: 'user', content: userMessage });

        // Chama a OpenAI com o histórico atualizado
        const completion = await openai.createChatCompletion({
            model: 'chatgpt-4o-latest', // Modelo utilizado
            messages: conversations[userId], // Histórico validado
        });

        const responseMessage = completion.data.choices[0].message.content;

        // Adiciona a resposta da IA ao histórico
        conversations[userId].push({ role: 'assistant', content: responseMessage });

        // Retorna a resposta e o histórico atualizado
        res.json({ response: responseMessage, chatHistory: conversations[userId] });
    } catch (error) {
        console.error(`❌ Erro durante a interação com a IA para userId=${userId}:`, error.message, error.stack);
        res.status(500).json({ response: "Erro ao processar a mensagem.", details: error.message });
    }
});

app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

module.exports = app;
