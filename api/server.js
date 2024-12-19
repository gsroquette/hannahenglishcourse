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

// Rota para iniciar a conversa
app.get('/api/start', async (req, res) => {
    const userId = req.query.uid;
    const studentLevel = req.query.level || "Level1";
    const studentUnit = req.query.unit || "Unit1";

    console.log("✅ Request recebido com os seguintes parâmetros:", { userId, studentLevel, studentUnit });

    if (!userId) {
        console.error("❌ User ID está ausente.");
        return res.status(400).json({ error: "User ID is required." });
    }

    let conversationDetails = 'General conversation';
    let conversationFullContent = '';

    try {
        const filePath = path.join(__dirname, '..', studentLevel, studentUnit, 'DataIA', 'conversa.txt');
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            conversationDetails = fileContent.split('\n')[0].trim();
            conversationFullContent = fileContent.trim();
        }
    } catch (error) {
        console.error(`❌ Erro ao carregar o arquivo: ${error.message}`);
        return res.status(500).json({ error: "Erro ao carregar o arquivo.", details: error.message });
    }

    try {
        const userRef = db.ref(`usuarios/${userId}/nome`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            console.error("❌ Usuário não encontrado no Firebase.");
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const studentName = snapshot.val();

        // Contexto para a IA
        const contextMessage = {
            role: "system",
            content: `
                You will act as Samuel, a friendly, native English-speaking robot.
                The student's name is ${studentName}, their level is ${studentLevel}, and the current unit is ${studentUnit}.
                The lesson topic is: ${conversationDetails}.
                Your job is to guide the student through the lesson while encouraging and correcting them.
            `,
        };

        // Salva o contexto no histórico
        if (!conversations[userId]) {
            conversations[userId] = [contextMessage];
            console.log(`📝 Contexto inicial salvo para userId=${userId}`);
        }

        const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

        // Retorna o histórico com o contexto
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
        console.error(`❌ Erro inesperado ao configurar o contexto: ${error.message}`);
        return res.status(500).json({ error: "Erro ao inicializar a conversa.", details: error.message });
    }
});

// Rota para interação com a IA
app.post('/api/chat', async (req, res) => {
    const userId = req.body.uid;
    const userMessage = req.body.message;

    console.log(`🔍 Requisição recebida para interação com a IA. userId=${userId}, mensagem="${userMessage}"`);

    if (!userId || !userMessage) {
        console.error("❌ Parâmetros ausentes: User ID ou mensagem estão faltando.");
        return res.status(400).json({ response: "User ID and message are required." });
    }

    try {
        // Inicializa o contexto se não existir
        if (!conversations[userId]) {
            console.warn(`⚠️ Contexto não encontrado para userId=${userId}. Inicializando...`);
            const contextMessage = {
              role: "system",
    content: `
        You are Samuel, a friendly and patient robot who helps students practice English conversation.
        The student's name is ${studentName}. Always address them by their name (e.g., "Hello ${studentName}!").
        The student's English level is ${studentLevel}, and the current unit is ${studentUnit}. The topic of today's lesson is: ${conversationDetails}.
        
        Guidelines:
        - Use language suitable for the student's level:
            - Level 1 (A1): Short, simple sentences (max 3 per interaction).
            - Level 2 (A2): Short sentences, clear and simple (max 3 per interaction).
            - Level 3 (B1): Slightly longer sentences (max 4 per interaction).
            - Level 4 (B2): Clear and concise sentences.
        - Focus on the lesson topic and avoid distractions.
        - Praise correct answers and encourage the student, even when mistakes are made.
        - Correct mistakes in grammar or pronunciation in a friendly way.
        - Always maintain a cheerful and motivating tone.

        Lesson Details:
        ${conversationFullContent.substring(0, 500)}  // Limita a informação adicional
    `,
};
            conversations[userId] = [contextMessage];
        }

        // Adiciona a mensagem do usuário ao histórico
        conversations[userId].push({ role: 'user', content: userMessage });

        // Chama a OpenAI com o histórico atualizado
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: conversations[userId],
        });

        const responseMessage = completion.data.choices[0].message.content;
        conversations[userId].push({ role: 'assistant', content: responseMessage });

        res.json({ response: responseMessage, chatHistory: conversations[userId] });
    } catch (error) {
        console.error("❌ Erro durante a interação com a IA:", error.message);
        res.status(500).json({ response: "Erro ao processar a mensagem.", details: error.message });
    }
});

app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

module.exports = app;
