const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initializeApp } = require('firebase/app'); // Firebase App SDK
const { getDatabase, ref, get } = require('firebase/database'); // Firebase Realtime Database SDK

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações do Express
app.use(cors({
    origin: '*', // Permitir todas as origens
}));
app.use(bodyParser.json());

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDGgo2H_hDKXF88xN7XnLFNUj8ikMY7Xdc",
    authDomain: "hannahenglishcourse.firebaseapp.com",
    databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hannahenglishcourse",
    storageBucket: "hannahenglishcourse.appspot.com",
    messagingSenderId: "449818788486",
    appId: "1:449818788486:web:8a49d3f68591e6fb3f0707"
};
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// Mensagem de contexto inicial
let contextMessage = {
    role: "system",
    content: `
        You will act as Lex, a native American, friendly, and patient robot. Your goal is to help the student practice English conversation in a focused, cheerful, and motivating way.
    `,
};

// Rota para buscar informações do Firebase e da URL
app.get('/api/start', async (req, res) => {
    try {
        const uid = req.query.uid; // O UID deve ser enviado via query string
        const level = req.query.level; // O nível deve ser enviado via query string

        if (!uid) {
            return res.status(400).json({ response: "UID do usuário não fornecido." });
        }

        if (!level) {
            return res.status(400).json({ response: "Level não fornecido na URL." });
        }

        // Busca o nome do usuário no Firebase Database
        const userRef = ref(database, `/usuarios/${uid}`);
        const snapshot = await get(userRef);

        if (!snapshot.exists()) {
            return res.status(404).json({ response: "Usuário não encontrado no Firebase." });
        }

        const userData = snapshot.val();
        const studentInfo = {
            name: userData.nome || "Student", // Nome do usuário
            level: level, // Nível extraído da URL
        };

        // Mensagem inicial
        const topic = "a general topic"; // Você pode adicionar lógica para personalizar o tópico
        const initialMessage = `Hello ${studentInfo.name}! My name is Lex, your robot friend. Your level is ${studentInfo.level}. Today's topic is: ${topic}. Shall we begin?`;

        res.json({
            response: initialMessage,
            studentInfo,
        });
    } catch (error) {
        console.error("Erro ao buscar informações do usuário no Firebase:", error.message);
        res.status(500).json({ response: "Error loading student data." });
    }
});

// Array para manter o histórico da conversa
const chatHistory = [contextMessage];

// Rota para interação com a IA
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ response: "Message cannot be empty." });
    }

    try {
        // Adicionar mensagem do usuário ao histórico
        chatHistory.push({ role: 'user', content: userMessage });

        // Fazer a chamada para a API OpenAI com o histórico completo
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: chatHistory,
        });

        const responseMessage = completion.data.choices[0].message.content;

        // Adicionar a resposta do robô ao histórico
        chatHistory.push({ role: 'assistant', content: responseMessage });

        res.json({ response: responseMessage });
    } catch (error) {
        console.error("Erro na API OpenAI:", error);
        res.status(500).json({ response: "Error processing the message." });
    }
});

// Rota para teste
app.get('/', (req, res) => {
    res.send("Servidor rodando com sucesso!");
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
