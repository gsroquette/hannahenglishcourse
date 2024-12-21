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
function createInitialContext(studentName, studentLevel, studentUnit, conversationDetails, conversationFullContent) {
    return {
        role: "system",
        content: `
You are Samuel, a friendly, patient, and motivating virtual robot friend.
Your goal is to help ${studentName} practice English. Always address them by their name.
They are currently at ${studentLevel}. Today's lesson topic is "${conversationDetails}". 
Additional information about the lesson:
${conversationFullContent}
        `,
    };
}

// Função para carregar o tópico e conteúdo do arquivo conversa.txt
function loadConversationDetails(level, unit) {
           const filePath = path.join(__dirname, '..', studentLevel, studentUnit, 'DataIA', 'conversa.txt');
    console.log(`📂 Tentando acessar o arquivo: ${filePath}`);

    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
        console.log("✅ Arquivo conversa.txt carregado com sucesso.");
        const lines = fileContent.split('\n');
        const topic = lines[0] ? lines[0].trim() : 'General conversation';
        return { topic, fullContent: fileContent };
    } else {
        console.warn(`⚠️ Arquivo conversa.txt não encontrado: ${filePath}. Usando 'General conversation'.`);
        return { topic: 'General conversation', fullContent: '' };
    }
}

// Endpoint /api/start
// Atualização no endpoint /api/start para corrigir o caminho do arquivo
app.get('/api/start', async (req, res) => {
    try {
        const userId = req.query.uid;
        const studentLevel = req.query.level || "Level1"; // Corrigido para incluir "Level" no valor padrão
        const studentUnit = req.query.unit || "Unit1";   // Corrigido para incluir "Unit" no valor padrão

        console.log("✅ Request recebido com os seguintes parâmetros:", { userId, studentLevel, studentUnit });

        if (!userId) {
            console.error("❌ User ID está ausente.");
            return res.status(400).json({ error: "User ID is required." });
        }

        let conversationDetails = 'General conversation';
        let conversationFullContent = '';

        // Caminho do arquivo conversa.txt corrigido
        const filePath = path.join(__dirname, '..', studentLevel, studentUnit, 'DataIA', 'conversa.txt');
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
    if (!Array.isArray(conversations[userId])) {
        conversations[userId] = [];
    }

    conversations[userId] = conversations[userId].filter(message => {
        return message && typeof message.role === 'string' && typeof message.content === 'string';
    });

    if (conversations[userId].length > 20) {
        conversations[userId] = conversations[userId].slice(-20);
    }
}

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
        // Inicializa o contexto se não existir
        if (!conversations[userId]) {
            console.warn(`⚠️ Contexto ausente para userId=${userId}. Criando um novo contexto.`);

            const userRef = db.ref(`usuarios/${userId}/nome`);
            const snapshot = await userRef.once('value');
            let studentName = "Student";

            if (snapshot.exists()) {
                studentName = snapshot.val();
                console.log(`✅ Nome do usuário recuperado do Firebase para userId=${userId}: ${studentName}`);
            }

            const studentLevel = "Level1"; // Nível genérico ou extraído
            const studentUnit = "Unit1"; // Unidade genérica ou extraída
            const { topic: conversationDetails, fullContent: conversationFullContent } = loadConversationDetails(studentLevel, studentUnit);

            // Cria o contexto inicial com os dados
            const contextMessage = createInitialContext(studentName, studentLevel, studentUnit, conversationDetails, conversationFullContent);
            conversations[userId] = [contextMessage];
        }

        // Valida e limpa o histórico antes de adicionar nova mensagem
        validateAndTrimHistory(userId);

        // Adiciona a mensagem do usuário ao histórico
        conversations[userId].push({ role: 'user', content: userMessage });

        // Chama a OpenAI com o histórico atualizado
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
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

app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

module.exports = app;
