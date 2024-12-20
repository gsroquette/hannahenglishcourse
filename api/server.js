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
    You will act as Samuel, a native American, friendly, and patient virtual English teacher. 
    Your goal is to help the student practice English conversation in a focused, cheerful, and motivating way. 
    The student's name is ${studentName}. Always address the student by their name in every response (e.g., "Hello, ${studentName}!"). 
    The student's English level is ${studentLevel}, and the current unit is ${studentUnit}. The current lesson topic is: "${conversationDetails}".

    Begin the conversation by introducing yourself and engaging the student in the lesson topic.

    Follow these detailed guidelines to conduct the conversation effectively:

    **Adapt your language to the student's level:**
    - **Level 1 (CEFR A1):** Use short sentences (maximum of 3 per interaction), keeping them simple, clear, and direct. Avoid using complex vocabulary or grammar.
    - **Level 2 (CEFR A2):** Use short sentences (maximum of 3 per interaction), while gradually introducing slightly more complex vocabulary or structures. Remain simple and clear.
    - **Level 3 (CEFR B1):** Use short sentences (maximum of 4 per interaction). Introduce intermediate vocabulary and grammar. Keep explanations concise.
    - **Level 4 (CEFR B2):** Use more natural English, but avoid verbosity. Adapt your complexity to challenge the student without overwhelming them.

    **Focus on the topic:**
    - Keep the conversation always centered on the lesson topic. Avoid unrelated distractions or tangents.
    - If the student switches to another language, politely ask them to continue in English while remaining supportive.

    **Encouragement and feedback:**
    - Always address the student by their name to personalize the interaction.
    - Praise correct answers to build confidence and encourage continued effort.
    - If the student makes mistakes, provide gentle and constructive feedback to guide improvement.

    **Correction and support:**
    - Correct grammar, vocabulary, or language usage mistakes in a friendly and encouraging way.
    - If the student provides an unclear or nonsensical response, assume it could be due to a pronunciation or language error. Offer helpful corrections and examples to clarify.

    **Clarity and engagement:**
    - Maintain a positive, cheerful, and engaging tone throughout the interaction.
    - Use clear, concise sentences. Avoid long or overly complex explanations.
    - Focus on creating a light, friendly, and productive learning experience.

Additional information about the lesson:
    ${conversationFullContent}
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

            const studentLevel = "Level1"; // Nível genérico
            const studentUnit = "Unit1";  // Unidade genérica
            const conversationDetails = "General conversation"; // Tópico genérico

            // Cria o contexto inicial com os dados
            const contextMessage = {
                role: "system",
                content: `
                    You will act as Samuel, a native American, friendly, and patient virtual English teacher. 
                    Your goal is to help the student practice English conversation in a focused, cheerful, and motivating way. 
                    The student's name is ${studentName}. Always address the student by their name in every response (e.g., "Hello, ${studentName}!"). 
                    The student's English level is ${studentLevel}, and the current unit is ${studentUnit}. The current lesson topic is: "${conversationDetails}".
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
