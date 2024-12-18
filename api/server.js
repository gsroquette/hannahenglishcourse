const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const admin = require('firebase-admin');

// Configuração Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
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

// Rota para iniciar a conversa (com Firebase)
app.get('/api/start', async (req, res) => {
    const userId = req.query.uid;
    const studentLevel = req.query.level || "Level1";
    const studentUnit = req.query.unit || "Unit1";

    if (!userId) {
        console.error("❌ [ERRO] Nenhum User ID foi fornecido.");
        return res.status(400).json({ error: "User ID is required" });
    }

    let conversationDetails = 'General conversation';
    let conversationFullContent = '';

    try {
        const filePath = path.join(__dirname, '..', studentLevel, studentUnit, 'DataIA', 'conversa.txt');
        console.log(`Tentando carregar: ${filePath}`);

        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            conversationDetails = fileContent.split('\n')[0].trim();
            conversationFullContent = fileContent.trim();
        } else {
            console.warn("⚠️ Arquivo conversa.txt não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao carregar conversa.txt:", error);
    }

    try {
        console.log(`🔍 Buscando dados no caminho: usuarios/${userId}/nome`);
        const userRef = db.ref(`usuarios/${userId}/nome`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ error: "User not found" });
        }

        const studentName = snapshot.val();
        console.log(`✅ Nome do usuário encontrado: ${studentName}`);

        // Atualizar contextMessage dinamicamente
        const contextMessage = {
            role: "system",
            content: `
                You will act as Samuel, a native American, friendly, and patient robot. 
                Your goal is to help the student to practice English conversation in a focused, cheerful, and motivating way. 
                The student's English level is ${studentLevel}, the current unit is ${studentUnit}, and the current lesson topic is: ${conversationDetails}.

                Follow these guidelines to conduct the conversation:

        Adapt your language to the student's level:
        - If the level is Level 1, it means that the student's English level in the CEFR is A1. Use short sentences (maximum of 3 per interaction), simple, clear and direct. Do not be verbose.
        - If the level is Level 2, it means that the student's English level in the CEFR is A2. Use short sentences (maximum of 3 per interaction), keeping them simple and clear. Do not be verbose.
        - If the level is Level 3, it means that the student's English level in the CEFR is B1. Use short sentences (maximum of 4 per interaction). Avoid being verbose.
        - If the level is Level 4, it means that the student's English level in the CEFR is B2. Avoid being verbose.

        Focus on the topic:
        - Keep the conversation always centered on the lesson topic and avoid distractions.
        - If the student speaks in another language, politely ask him to switch back to English.

        Interaction:
        - Address the student by name.
        - Praise correct answers and encourage the student even when he or she makes mistakes.

        Correction and support:
        - Correct grammar and language usage mistakes in a friendly and motivating way.
        - If you receive a nonsensical response or fail to understand something, assume it could be a pronunciation error. Help the student to fix and improve her speech.

        Clarity and objectivity:
        - Maintain a positive and encouraging tone throughout the interaction.
        - Avoid long or complex sentences.
        - Keep the learning experience light, friendly, and productive!

Additional information about the lesson:
${conversationFullContent}
            `,
        };

        // Atualizar o chatHistory com o novo contexto
        chatHistory.length = 0; // Limpar histórico antigo
        chatHistory.push(contextMessage);

        const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

        return res.json({
            response: initialMessage,
            studentInfo: {
                name: studentName,
                level: studentLevel,
                unit: studentUnit,
                fullContent: conversationFullContent,
            },
        });
    } catch (error) {
        console.error("❌ Erro ao acessar o Firebase:", error.message);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// Rota para interação com a IA
const chatHistory = []; // Historico dinâmico da conversa
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ response: "Message cannot be empty." });
    }

    try {
        chatHistory.push({ role: 'user', content: userMessage });

        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: chatHistory,
        });

        const responseMessage = completion.data.choices[0].message.content;
        chatHistory.push({ role: 'assistant', content: responseMessage });

        res.json({ response: responseMessage });
    } catch (error) {
        console.error("Erro na API OpenAI:", error);
        res.status(500).json({ response: "Error processing the message." });
    }
});

app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
