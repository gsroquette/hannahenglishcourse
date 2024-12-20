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

    // Verificação de ID do usuário
    if (!userId) {
        console.error("❌ User ID está ausente.");
        return res.status(400).json({ error: "User ID is required." });
    }

    let conversationDetails = 'General conversation';
    let conversationFullContent = '';

    try {
        // Caminho do arquivo
        const filePath = path.join(__dirname, '..', studentLevel, studentUnit, 'DataIA', 'conversa.txt');
        console.log(`🔍 Verificando existência do arquivo em: ${filePath}`);

        // Verificar se o arquivo existe
        if (!fs.existsSync(filePath)) {
            console.error(`⚠️ Arquivo não encontrado: ${filePath}`);
            return res.status(404).json({ error: `Arquivo não encontrado em ${filePath}` });
        }

        // Tentar ler o conteúdo do arquivo
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            console.log("📄 Arquivo carregado com sucesso. Conteúdo inicial:", fileContent);

            conversationDetails = fileContent.split('\n')[0].trim();
            conversationFullContent = fileContent.trim();
        } catch (error) {
            console.error(`❌ Erro ao ler o arquivo ${filePath}:`, error.message);
            return res.status(500).json({ error: "Erro ao carregar o arquivo.", details: error.message });
        }
    } catch (error) {
        console.error("❌ Erro inesperado ao carregar o arquivo:", error.message);
        return res.status(500).json({ error: "Erro interno ao processar arquivo.", details: error.message });
    }

    try {
        // Buscar nome do usuário no Firebase
        console.log(`🔍 Buscando nome do usuário no Firebase para userId: ${userId}`);
        const userRef = db.ref(`usuarios/${userId}/nome`);
        console.log(`🔍 Caminho do Firebase: usuarios/${userId}/nome`);

        const snapshot = await userRef.once('value');
        console.log(`📊 Snapshot do Firebase: ${snapshot.exists() ? snapshot.val() : "Não encontrado"}`);

        // Verificar se o usuário existe no Firebase
        if (!snapshot.exists()) {
            console.error("❌ Usuário não encontrado no Firebase.");
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const studentName = snapshot.val();
        console.log(`✅ Nome do usuário recuperado do Firebase: ${studentName}`);

        // Criar mensagem de contexto para o GPT-4
        const contextMessage = {
            role: "system",
              content: `
          You will act as Samuel, a native American, friendly, and patient robot. Your goal is to help the student to practice English conversation in a focused, cheerful, and motivating way. The student's name is ${studentName}. Always address the student by their name in every response (e.g., "Hello Carla!"). The student's English level is ${studentLevel} and the current unit is ${studentUnit}, and the current lesson topic is: ${conversationDetails}.

        Start the conversation by applying the lesson

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

        // Salvar o contexto na memória do servidor
        conversations[userId] = [contextMessage];
        console.log(`📝 Contexto gerado e salvo para userId=${userId}:`, JSON.stringify(contextMessage));

        // Mensagem inicial para o aluno
        const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

        console.log(`💬 Mensagem inicial enviada ao aluno: ${initialMessage}`);

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
        console.error(`❌ Erro inesperado ao recuperar dados do usuário: ${error.message}`);
        return res.status(500).json({ error: "Erro interno ao recuperar dados do usuário.", details: error.message });
    }
});

// Rota para interação com a IA
app.post('/api/chat', async (req, res) => {
    const userId = req.body.uid;
    const userMessage = req.body.message;

    console.log(`🔍 Requisição recebida para interação com a IA. userId=${userId}, mensagem="${userMessage}"`);

    // Validação: verificar se userId e userMessage estão presentes
    if (!userId || !userMessage) {
        console.error("❌ Parâmetros ausentes: User ID ou mensagem estão faltando.");
        return res.status(400).json({ response: "User ID and message are required." });
    }

    try {
        // Verificar se o histórico existe para o usuário
        if (!conversations[userId]) {
            console.warn(`⚠️ Histórico não encontrado para o usuário ${userId}. Inicializando contexto padrão.`);
            conversations[userId] = [
                {
                    role: 'system',
                    content: "Conversation initialized. Provide guidance based on previous context.",
                },
            ];
        } else {
            console.log(`✅ Histórico encontrado para userId=${userId}:`, JSON.stringify(conversations[userId]));
        }

        // Adicionar a mensagem do usuário ao histórico
        conversations[userId].push({ role: 'user', content: userMessage });
        console.log("📨 Mensagem do usuário adicionada ao histórico:", userMessage);

        // Chamada para a API OpenAI
        console.log("🔄 Enviando histórico atualizado para a API OpenAI...");
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: conversations[userId],
        });

        // Processar resposta da OpenAI
        const responseMessage = completion.data.choices[0].message.content;
        console.log("✅ Resposta gerada pela OpenAI:", responseMessage);

        // Adicionar a resposta ao histórico
        conversations[userId].push({ role: 'assistant', content: responseMessage });
        console.log("💬 Resposta da IA adicionada ao histórico:", responseMessage);

        // Responder ao cliente
        res.json({ response: responseMessage, chatHistory: conversations[userId] });
    } catch (error) {
        console.error(`❌ Erro durante a interação com a API OpenAI para userId=${userId}:`, error.response ? error.response.data : error.message);

        // Retornar erro ao cliente
        res.status(500).json({
            response: "Erro ao processar a mensagem.",
            details: error.response ? error.response.data : error.message,
        });
    }
});

app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

module.exports = app;
