const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const admin = require('firebase-admin');

// ======================
//  IMPORT E CONFIG TTS
// ======================
const textToSpeech = require('@google-cloud/text-to-speech');

// Lê as credenciais do Google TTS da variável de ambiente
console.log("GOOGLE_TTS_SERVICE_ACCOUNT:", process.env.GOOGLE_TTS_SERVICE_ACCOUNT ? "DEFINIDO" : "NÃO DEFINIDO");
const ttsCredentials = JSON.parse(process.env.GOOGLE_TTS_SERVICE_ACCOUNT || '{}');

// Cria o cliente de TTS usando as credenciais vindas do ambiente
const ttsClient = new textToSpeech.TextToSpeechClient({
    credentials: ttsCredentials,
});

// ===================================
//  CONFIGURAÇÃO FIREBASE ADMIN
// ===================================
console.log("FIREBASE_SERVICE_ACCOUNT:", process.env.FIREBASE_SERVICE_ACCOUNT || "NÃO DEFINIDO"); // Verifica o valor da variável de ambiente

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
    console.log("Firebase inicializado com sucesso!");
} catch (error) {
    console.error("Erro ao inicializar o Firebase:", error.message);
}

const db = admin.database(); // Inicializa o banco de dados Firebase

// ===================================
//  CONFIGURAÇÃO DO EXPRESS
// ===================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// ===================================
//  CONFIGURAÇÃO OPENAI
// ===================================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===================================
//  ARMAZENAMENTO EM MEMÓRIA
// ===================================
const conversations = {};

// ===================================
//  FUNÇÕES AUXILIARES
// ===================================

// Cria o contexto inicial para a conversa
function createInitialContext(studentName, studentLevel, studentUnit, conversationDetails, conversationFullContent) {
    return {
        role: "system",
        content: `
You are Samuel, a friendly, patient, and motivating virtual robot.
Help ${studentName} practice English, always addressing him/her by name.
They are at ${studentLevel} level.
Keep the conversation centered on ${conversationFullContent}.

Start by saying: "Let's begin the lesson, ${studentName}!" and begin the class.
After covering all of ${conversationFullContent}, thank, congratulate, and say goodbye, affirming that he/she is ready for the next stage. Then, stop interacting. If the student insists, politely refuse and ask to go to the next class and say: press the black button to go back

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
`
    };
}

// Lê o arquivo conversa.txt para recuperar o tópico e conteúdo
async function loadConversationDetails(level, unit) {
    // LOG adicional para confirmar quais parâmetros foram recebidos
    console.log(`[loadConversationDetails] Recebido level="${level}", unit="${unit}"`);

    // Monta a URL de onde o arquivo será buscado
    const url = `https://hannahenglishcourse.netlify.app/${level}/${unit}/DataIA/conversa.txt`;

    // LOG adicional para ver a URL exata
    console.log(`[loadConversationDetails] Buscando conversa.txt de: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Status ${response.status}`);
        }
        const fileContent = await response.text();

        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        const topic = lines.length > 0 ? lines[0].trim() : 'General conversation';
        const sanitizedContent = fileContent.replace(/###|\d+\.\s/g, '').trim();

        console.log("✅ conversa.txt carregado com sucesso via HTTP.");
        return { topic, fullContent: sanitizedContent };
    } catch (err) {
        console.warn(`⚠️ Falha ao buscar conversa.txt: ${err.message}`);
        return { topic: 'General conversation', fullContent: '' };
    }
}

// Valida e limpa o histórico de mensagens para não passar de 20
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

// ===================================
//  ENDPOINT /api/start (GET)
// ===================================
app.get('/api/start', async (req, res) => {
    try {
        const userId = req.query.uid;
        const studentLevel = req.query.level || "Level1"; 
        const studentUnit = req.query.unit || "Unit1";

        // LOG adicional
        console.log(`[GET /api/start] userId="${userId}", level="${studentLevel}", unit="${studentUnit}"`);

        if (!userId) {
            console.error("❌ User ID está ausente.");
            return res.status(400).json({ error: "User ID is required." });
        }

        // Tenta carregar dados do arquivo conversa.txt
        const { topic: conversationDetails, fullContent: conversationFullContent } = 
            await loadConversationDetails(studentLevel, studentUnit);

        // Recupera o nome do aluno no Firebase
        const userRef = db.ref(`usuarios/${userId}/nome`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            console.error(`❌ Usuário não encontrado no Firebase para userId=${userId}.`);
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const studentName = snapshot.val();
        console.log(`✅ Nome do usuário recuperado do Firebase: ${studentName}`);

        // Cria o contexto inicial
        const contextMessage = createInitialContext(
            studentName,
            studentLevel,
            studentUnit,
            conversationDetails,
            conversationFullContent
        );

        // Mensagem inicial
        const initialMessage = `Hello ${studentName}! Today's topic is: ${conversationDetails}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;

        // (Re)inicializa o array de conversas
        // **IMPORTANTE**: garantir que contextMessage fique em primeiro
        conversations[userId] = [
            contextMessage,
            { studentName, studentLevel, studentUnit },
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

// ===================================
//  ENDPOINT /api/chat (POST)
// ===================================
app.post('/api/chat', async (req, res) => {
    const userId = req.body.uid;
    const userMessage = req.body.message;

    // LOG adicional
    console.log(`[POST /api/chat] userId="${userId}", userMessage="${userMessage}"`);

    // Valida os parâmetros recebidos
    if (typeof userId !== 'string' || !userId.trim() || typeof userMessage !== 'string' || !userMessage.trim()) {
        console.error("❌ Parâmetros ausentes ou inválidos: User ID ou mensagem estão faltando.");
        return res.status(400).json({ response: "User ID and message are required and must be valid strings." });
    }

    try {
        // Se não existir contexto, cria um novo (caso /api/chat seja chamado antes de /api/start)
        if (!conversations[userId]) {
            console.warn(`⚠️ Contexto ausente para userId=${userId}. Criando um novo contexto.`);

            // Pega o nome do usuário
            const userRef = db.ref(`usuarios/${userId}/nome`);
            const snapshot = await userRef.once('value');
            let studentName = "Student";

            if (snapshot.exists()) {
                studentName = snapshot.val();
                console.log(`✅ Nome do usuário recuperado do Firebase: ${studentName}`);
            }

            // Se a chamada vier sem "level" e "unit" no body, usamos defaults
            const studentLevel = req.body.level || "Level1";
            const studentUnit = req.body.unit || "Unit1";

            // LOG adicional
            console.log(`[POST /api/chat] Carregando conversa.txt com level="${studentLevel}", unit="${studentUnit}" (fallback)`);

            // Carrega o conversa.txt
            const { topic: conversationDetails, fullContent: conversationFullContent } =
                await loadConversationDetails(studentLevel, studentUnit);

            // Cria contexto inicial
            const contextMessage = createInitialContext(
                studentName,
                studentLevel,
                studentUnit,
                conversationDetails,
                conversationFullContent
            );

            conversations[userId] = [contextMessage];
        }

        // Valida e limpa o histórico
        validateAndTrimHistory(userId);

        // Adiciona a mensagem do usuário
        conversations[userId].push({ role: 'user', content: userMessage });

        // Chama a OpenAI com o histórico atualizado
        const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini-2024-07-18',
  messages: conversations[userId],
});

const responseMessage = completion.choices[0].message.content;

        // Adiciona a resposta da IA ao histórico
        conversations[userId].push({ role: 'assistant', content: responseMessage });

        // Retorna a resposta
        res.json({ response: responseMessage, chatHistory: conversations[userId] });
    } catch (error) {
        console.error(`❌ Erro durante a interação com a IA para userId=${userId}: ${error.message}`);
        res.status(500).json({ response: "Erro ao processar a mensagem.", details: error.message });
    }
});

// ===================================
//  ENDPOINT /api/tts (POST) - GOOGLE TTS
// ===================================
app.post('/api/tts', async (req, res) => {
    try {
        const { text, speakingRate } = req.body;
        console.log("[/api/tts] Texto recebido para TTS:", text, "speakingRate:", speakingRate);

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: "Texto inválido ou ausente." });
        }

        const request = {
            input: { text },
            voice: {
                languageCode: 'en-US',
                name: 'en-US-Standard-I', // Define a voz específica
                ssmlGender: 'MALE' // 'I' é uma voz masculina
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: speakingRate || 1.0
            },
        };

        console.log("[/api/tts] Enviando request para Google TTS:", request);

        const [response] = await ttsClient.synthesizeSpeech(request);
        console.log("[/api/tts] Resposta do Google TTS recebida com sucesso.");

        // Convertemos o Buffer em base64 (caso venha como buffer)
        const audioContent = response.audioContent ? response.audioContent.toString('base64') : null;
        if (!audioContent) {
            console.error("[/api/tts] A resposta do TTS não contém 'audioContent'.");
            return res.status(500).json({ error: "Falha ao gerar o áudio." });
        }

        // Retornamos o base64 para o front-end
        return res.json({ audioContent });
    } catch (error) {
        console.error("[/api/tts] Erro ao processar TTS:", error);
        return res.status(500).json({ error: "Erro ao gerar áudio TTS.", details: error.message });
    }
});

// ===================================
//  ROTA RAIZ - TESTE
// ===================================
app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));

// ===================================
//  INICIALIZA O SERVIDOR
// ===================================
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

// ===================================
//  EXPORT (caso precise em outro lugar)
// ===================================
module.exports = app;
