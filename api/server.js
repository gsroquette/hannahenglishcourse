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
You are Samuel, a friendly, patient, and motivating virtual friend. 
Your goal is to help ${studentName} practice English conversation. Always address them by their name (e.g., "Hello, ${studentName}!"). 
They are currently at ${studentLevel}. Today's lesson topic is "${conversationDetails}".

Adapt your responses to the student's level:
- Level 1: Use short, simple sentences (max 3 per turn). Avoid complex vocabulary.
- Level 2: Gradually introduce slightly complex vocabulary (max 3 sentences per turn).
- Level 3: Use intermediate vocabulary and grammar (max 4 sentences per turn).
- Level 4: Use more natural English but stay concise.

Focus on the topic and keep it engaging:
- Keep the conversation centered on "${conversationDetails}".
- Politely ask the student to speak English if they switch to another language.
- Praise correct answers and offer constructive feedback on mistakes.

Maintain a positive, light, and productive learning tone.

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
        conversationDetails = fileContent.split('\n')[0].trim(); // Primeira linha como tópico
        conversationFullContent = fileContent.trim(); // Conteúdo completo
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
        console.log(`✅ Nome do usuário recuperado do Firebase: ${studentName}`);

        // Cria o contexto inicial usando a função
        const contextMessage = createInitialContext(studentName, studentLevel, studentUnit, conversationDetails);

        // Mensagem inicial
        const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

        // Salva ou atualiza o contexto no histórico
        if (!conversations[userId]) {
            conversations[userId] = [
                { studentName, studentLevel, studentUnit }, // Salva detalhes do aluno
                contextMessage,
                { role: "assistant", content: initialMessage }, // Mensagem inicial como parte do histórico
            ];
            console.log(`📝 Contexto inicial salvo para userId=${userId}`);
        } else {
            conversations[userId].unshift(contextMessage);
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

            // Carrega informações adicionais do arquivo conversa.txt
          try {
    // Define o caminho dinâmico para o arquivo conversa.txt
    const filePath = path.join(__dirname, '..', studentLevel, studentUnit, 'DataIA', 'conversa.txt');
    console.log(`🔍 Tentando carregar o arquivo de conversa: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Arquivo não encontrado no caminho: ${filePath}. Usando tópico genérico.`);
    } else {
        const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
        if (!fileContent) {
            console.error("❌ O arquivo conversa.txt está vazio. Usando tópico genérico.");
        } else {
            // Define o tópico e conteúdo completo do arquivo
            conversationDetails = fileContent.split('\n')[0].trim(); // Primeira linha como tópico
            conversationFullContent = fileContent; // Conteúdo completo
            console.log(`✅ Arquivo carregado com sucesso. Tópico: "${conversationDetails}"`);
        }
    }
} catch (error) {
    console.error(`❌ Erro ao carregar o arquivo conversa.txt: ${error.message}. Usando tópico genérico.`);
}

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

        // Adiciona a mensagem do usuário ao histórico
        conversations[userId].push({ role: 'user', content: userMessage });

        // Limita o tamanho do histórico
        if (conversations[userId].length > 20) { // Mantém no máximo 20 mensagens
            conversations[userId] = conversations[userId].slice(-20);
        }

        // Chama a OpenAI com o histórico atualizado
        const completion = await openai.createChatCompletion({
    model: 'gpt-4o', // Alterar para GPT-4o
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
