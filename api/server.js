const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const admin = require('firebase-admin');

// Configuração Firebase Admin
console.log("FIREBASE_SERVICE_ACCOUNT:", process.env.FIREBASE_SERVICE_ACCOUNT || "NÃO DEFINIDO"); // Verifica o valor da variável de ambiente

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
    console.log("Firebase inicializado com sucesso!");
} catch (error) {
    console.error("Erro ao inicializar o Firebase:", error.message); // Exibe erro se o JSON for inválido ou incompleto
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
The lesson topic is "${conversationDetails}". Keep the conversation centered on ${conversationFullContent}.

Start by saying: "Let's begin the lesson, ${studentName}!" and begin the class.
After covering all of ${conversationFullContent}, thank, congratulate, and say goodbye, affirming that he/she is ready for the next stage. Then, stop interacting. If the student insists, politely decline and ask to go to the next lesson.

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
        const lines = fileContent.split('\n');
        const topic = lines[0] ? lines[0].trim() : 'General conversation';
        return { topic, fullContent: fileContent };
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

    if (conversations[userId].length > 20) {
        conversations[userId] = conversations[userId].slice(-20);
    }
}

// Endpoint /api/start
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

        // **Sempre** recriamos o array de conversas (para evitar cache antigo)
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
        // Se não houver contexto ainda, cria um novo (isso normalmente só acontece se alguém chamar /api/chat antes de /api/start)
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
            model: 'chatgpt-4o-latest', // Certifique-se de que este modelo exista na sua conta
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

// Rota raiz para ver se está tudo ok
app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

// Inicializa o servidor
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

// Exporta o app para uso em testes ou outros módulos
module.exports = app;
