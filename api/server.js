const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const admin = require('firebase-admin');

// Configuração Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = admin.database();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// Configuração da API do OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Carregar informações do arquivo conversa.txt
let conversationDetails = 'General conversation';
try {
    const filePath = path.join(__dirname, 'conversa.txt');
    if (fs.existsSync(filePath)) {
        conversationDetails = fs.readFileSync(filePath, 'utf-8').trim();
    }
} catch (error) {
    console.error("Erro ao carregar conversa.txt:", error);
}

// Mensagem de contexto inicial
const contextMessage = {
    role: "system",
    content: `Today's topic is: ${conversationDetails}. Focus on motivating and helping the student practice English.`,
};

// Rota para iniciar a conversa (com Firebase)
app.get('/api/start', async (req, res) => {
    const userId = req.query.uid;

    if (!userId) {
        console.error("❌ [ERRO] Nenhum User ID foi fornecido.");
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        console.log(`🔍 Buscando dados no caminho: usuarios/${userId}/nome`);

        // Verificar a referência no Firebase
        const userRef = db.ref(`usuarios/${userId}/nome`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            console.warn(`⚠️ [AVISO] Nenhum dado encontrado para UID: ${userId}`);
            return res.status(404).json({ error: "User not found" });
        }

        const studentName = snapshot.val();
        console.log(`✅ [SUCESSO] Nome do usuário encontrado: ${studentName}`);

        // Responder com os dados
        const initialMessage = `Hello ${studentName}! My name is Samuel, your robot friend. Today's topic is: General conversation. Shall we begin?`;

        return res.json({
            response: initialMessage,
            studentInfo: {
                name: studentName,
                level: "Level1",
            },
        });
    } catch (error) {
        console.error("❌ [ERRO] Falha ao acessar o Firebase:", error.message);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// Rota para interação com a IA (OpenAI)
const chatHistory = [contextMessage];
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

// Rota padrão para teste
app.get('/', (req, res) => {
    res.send("Servidor rodando com sucesso!");
});

// Inicializar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
