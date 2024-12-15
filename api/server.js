const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin'); // SDK do Firebase Admin para Node.js
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações do Express
app.use(cors({
    origin: '*', // Permitir todas as origens
}));
app.use(bodyParser.json());

// Inicializar Firebase Admin SDK
const firebaseConfig = {
    credential: admin.credential.cert({
        type: "service_account",
        project_id: "hannahenglishcourse",
        private_key_id: "SUA_PRIVATE_KEY_ID", // Substitua por sua chave privada do Firebase Admin SDK
        private_key: "-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
        client_email: "firebase-adminsdk@hannahenglishcourse.iam.gserviceaccount.com",
        client_id: "CLIENT_ID",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk"
    }),
    databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app"
};
admin.initializeApp(firebaseConfig);

// Configuração da API do OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

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
        // Substitua 'uidDoUsuarioLogado' pelo UID do usuário logado
        const uid = req.query.uid; // O UID deve ser enviado via query string
        const level = req.query.level; // O nível deve ser enviado via query string

        if (!uid) {
            return res.status(400).json({ response: "UID do usuário não fornecido." });
        }

        if (!level) {
            return res.status(400).json({ response: "Level não fornecido na URL." });
        }

        // Busca o nome do usuário no Firebase Database
        const userRef = admin.database().ref(`/usuarios/${uid}`);
        const snapshot = await userRef.once('value');

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
