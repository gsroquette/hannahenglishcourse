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
            You are Samuel, a native, friendly, and patient English teacher.
            Guide ${studentName}, who is currently at ${studentLevel} studying ${studentUnit}.
            The focus of today's conversation is "${conversationDetails}".
            Keep the interaction engaging and educational.
        `,
    };
}

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
        // Carrega informações adicionais do arquivo
        const filePath = path.join(__dirname, '..', studentLevel, studentUnit, 'DataIA', 'conversa.txt');
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Arquivo não encontrado: ${filePath}`);
            console.error(`❌ Arquivo não encontrado: ${filePath}`);
return res.status(404).json({ error: "Data file not found for the conversation. Please verify the path." });
        }
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        conversationDetails = fileContent.split('\n')[0].trim();
        conversationFullContent = fileContent.trim();
    } catch (error) {
        console.error(`❌ Erro ao carregar o arquivo: ${error.message}`);
        return res.status(500).json({ error: "Erro ao carregar o arquivo.", details: error.message });
    }

    try {
        // Busca o nome do aluno no Firebase
        const userRef = db.ref(`usuarios/${userId}/nome`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            console.error(`❌ Usuário não encontrado no Firebase para userId=${userId}.`);
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const studentName = snapshot.val();

        // Cria o contexto inicial usando uma função
        const contextMessage = createInitialContext(studentName, studentLevel, studentUnit, conversationDetails);

        // Mensagem inicial
        const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

        // Salva o contexto no histórico
        if (!conversations[userId]) {
            conversations[userId] = [
                contextMessage,
                { role: "assistant", content: initialMessage }, // Mensagem inicial como parte do histórico
            ];
            console.log(`📝 Contexto inicial salvo para userId=${userId}`);
        }

        // Limita o tamanho do histórico
        if (conversations[userId].length > 20) {
            conversations[userId] = conversations[userId].slice(-20);
        }

        // Retorna a mensagem inicial e o histórico para o frontend
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
        console.error(`❌ Erro ao configurar o contexto para userId=${userId}:`, error);
        return res.status(500).json({ error: "Erro ao inicializar a conversa.", details: error.message });
    }
});

// Rota para interação com a IA
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
            const contextMessage = {
                role: "system",
                content: `
                    You are Samuel, a native, friendly, and patient English teacher.
                    Guide the student through today's lesson and keep the conversation focused on the topic.
                `,
            };
            conversations[userId] = [contextMessage];
        }

        // Adiciona a mensagem do usuário ao histórico
        conversations[userId].push({ role: 'user', content: userMessage });

        // Limita o tamanho do histórico
        if (conversations[userId].length > 20) { // Mantém no máximo 20 mensagens
            conversations[userId] = conversations[userId].slice(-20);
        }

        // Chama a OpenAI com o histórico atualizado
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: conversations[userId],
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
