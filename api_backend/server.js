// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const textToSpeech = require('@google-cloud/text-to-speech');

// ======================
// GOOGLE TTS
// ======================
console.log("GOOGLE_TTS_SERVICE_ACCOUNT:", process.env.GOOGLE_TTS_SERVICE_ACCOUNT ? "DEFINIDO" : "NÃO DEFINIDO");
const ttsCredentials = JSON.parse(process.env.GOOGLE_TTS_SERVICE_ACCOUNT || '{}');
const ttsClient = new textToSpeech.TextToSpeechClient({
    credentials: ttsCredentials
});

// ======================
// FIREBASE ADMIN
// ======================
console.log("FIREBASE_SERVICE_ACCOUNT:", process.env.FIREBASE_SERVICE_ACCOUNT || "NÃO DEFINIDO");
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

const db = admin.database();

// ======================
// EXPRESS
// ======================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// ======================
// OPENAI
// ======================
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// ======================
// CONTROLE DE TOKENS
// ======================
const TOKENS_CONTROL_ENABLED = true;
// Preços / limites pensados para gpt-4o-mini-2024-07-18
const tokenConfig = {
    wallet: {
        seed: 325000
    }, // saldo global inicial
    unitCaps: {
        Level0: 1000,
        Level1: 2000,
        Level2: 3000,
        Level3: 4000,
        Level4: 5000
    },
    minSessionReserve: 300, // reserva mínima para não travar no meio da resposta
    maxOut: 120 // limite de tokens de saída por resposta
};

// ======================
// ESTADO EM MEMÓRIA
// ======================
const conversations = {};

// ======================
// HELPERS
// ======================
function normalizeLevelForCap(level) {
    if (!level) return 'Level1';
    const low = String(level).toLowerCase();
    const map = {
        level0: 'Level0',
        level1: 'Level1',
        level2: 'Level2',
        level3: 'Level3',
        level4: 'Level4'
    };
    return map[low] || level; // se já veio "LevelX", mantém
}

function createInitialContext(studentName, studentLevel, studentUnit, topic, fullContent) {
    return {
        role: "system",
        content: `You are Samuel, a friendly, patient, and motivating virtual robot. Help ${studentName} practice English, always addressing him/her by name. They are at ${studentLevel} level. Keep the conversation centered on ${fullContent || topic}. Start by saying: "Let's begin the lesson, ${studentName}!" and begin the class. After covering all of ${fullContent || topic}, thank, congratulate, and say goodbye, affirming that he/she is ready for the next stage. Then, stop interacting. If the student insists, politely refuse and ask to go to the next class and say: press the black button to go back. Adapt the language according to the level (CEFR): Level 0: little children, 1–2 very simple sentences. Level 1 (A1): up to 3 short sentences. Level 2 (A2): up to 3 simple sentences. Level 3 (B1): up to 4 simple sentences. Level 4 (B2): slightly longer but clear sentences. Interaction Tips: Keep responses short and to the point. If the student speaks another language, gently ask them to use English. Praise correct answers. If there's a mistake, ask them to try again once. If the error persists, provide the correct form, encourage them, and move on. Text only (no emojis).`
    };
}

// Carrega conversa.txt da unidade
async function loadConversationDetails(level, unit) {
    console.log(`[loadConversationDetails] level="${level}", unit="${unit}"`);
    const url = `https://hannahenglishcourse.netlify.app/${level}/${unit}/DataIA/conversa.txt`;
    
    try {
        const fetchRes = await fetch(url);
        if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
        const fileContent = await fetchRes.text();
        const lines = fileContent.split('\n').filter(l => l.trim() !== '');
        const topic = lines[0]?.trim() || 'General conversation';
        const sanitizedContent = fileContent.replace(/###|\d+\.\s/g, '').trim();
        
        console.log("✅ conversa.txt carregado via HTTP.");
        return { topic, fullContent: sanitizedContent };
    } catch (err) {
        console.warn(`⚠️ Falha ao buscar conversa.txt (${url}): ${err.message}`);
        return { topic: 'General conversation', fullContent: '' };
    }
}

function validateAndTrimHistory(userId) {
    if (!Array.isArray(conversations[userId])) {
        conversations[userId] = [];
        return;
    }
    
    // Filtra apenas mensagens válidas mantendo a estrutura correta
    conversations[userId] = conversations[userId].filter(m => 
        m && typeof m === 'object' && 
        typeof m.role === 'string' && 
        typeof m.content === 'string'
    );
    
    // Mantém o contexto system e meta sempre
    const systemContext = conversations[userId].find(m => m.role === "system");
    const metaInfo = conversations[userId].find(m => m.studentName);
    
    // Filtra apenas user/assistant messages para trim
    const chatMessages = conversations[userId].filter(m => 
        m.role === 'user' || m.role === 'assistant'
    );
    
    // Mantém apenas as últimas 20 mensagens de chat
    const trimmedChat = chatMessages.slice(-20);
    
    // Reconstrói o array mantendo contexto e meta
    conversations[userId] = [];
    if (systemContext) conversations[userId].push(systemContext);
    if (metaInfo) conversations[userId].push(metaInfo);
    conversations[userId].push(...trimmedChat);
}

// ======================
// /api/start
// ======================
app.get('/api/start', async (req, res) => {
    try {
        const userId = req.query.uid;
        const rawLevel = req.query.level || "Level1";
        const rawUnit = req.query.unit || "Unit1";

        if (!userId) {
            return res.status(400).json({ error: "User ID is required." });
        }

        console.log(`[GET /api/start] uid="${userId}", level="${rawLevel}", unit="${rawUnit}"`);

        // Dados do aluno
        const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
        if (!nameSnap.exists()) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const studentName = nameSnap.val();

        // Carrega conteúdo da unidade
        const { topic, fullContent } = await loadConversationDetails(rawLevel, rawUnit);

        // Cria contexto + primeira fala
        const context = createInitialContext(studentName, rawLevel, rawUnit, topic, fullContent);
        const initialMessage = `Hello ${studentName}! Today's topic is: ${topic}. I'm ready to help you at your ${rawLevel}, in ${rawUnit}. Shall we begin?`;

        conversations[userId] = [
            context,
            { studentName, studentLevel: rawLevel, studentUnit: rawUnit }, // META para recuperar depois
            { role: "assistant", content: initialMessage },
        ];

        validateAndTrimHistory(userId);

        // ------- TOKENS -------
        let tokenInfo = {};
        if (TOKENS_CONTROL_ENABLED) {
            const walletRef = db.ref(`wallet/${userId}`);
            const usageRef = db.ref(`usage/${userId}/${rawLevel}/${rawUnit}`);

            // Garantir wallet
            const walletSnap = await walletRef.once('value');
            if (!walletSnap.exists()) {
                await walletRef.set({
                    balanceTokens: tokenConfig.wallet.seed,
                    createdAt: Date.now(),
                    ledger: {
                        init: {
                            type: "credit",
                            amount: tokenConfig.wallet.seed,
                            reason: "initial_seed",
                            timestamp: Date.now()
                        }
                    }
                });
            }

            // Garantir usage (cap depende do level normalizado)
            const capKey = normalizeLevelForCap(rawLevel);
            const unitCap = tokenConfig.unitCaps[capKey] || 1000;
            const usageSnap = await usageRef.once('value');
            if (!usageSnap.exists()) {
                await usageRef.set({
                    unitCap,
                    allowedTokens: unitCap,
                    usedTokens: 0,
                    remainingTokens: unitCap,
                    minSessionReserve: tokenConfig.minSessionReserve,
                    createdAt: Date.now()
                });
            }

            // Reserva mínima (pull da carteira, se fizer sentido)
            let usage = (await usageRef.once('value')).val();
            let wallet = (await walletRef.once('value')).val();
            let canChat = true;

            if (usage.remainingTokens < tokenConfig.minSessionReserve) {
                const needed = tokenConfig.minSessionReserve - usage.remainingTokens;
                const transferable = Math.min(
                    needed,
                    wallet.balanceTokens || 0,
                    usage.unitCap - usage.allowedTokens
                );

                if (transferable > 0) {
                    await walletRef.update({
                        balanceTokens: (wallet.balanceTokens || 0) - transferable
                    });
                    await usageRef.update({
                        allowedTokens: usage.allowedTokens + transferable,
                        remainingTokens: usage.remainingTokens + transferable
                    });
                    usage = (await usageRef.once('value')).val();
                    wallet = (await walletRef.once('value')).val();
                } else {
                    canChat = usage.remainingTokens > 0;
                }
            }

            tokenInfo = {
                unitCap: usage.unitCap,
                remainingUnit: usage.remainingTokens,
                allowedUnit: usage.allowedTokens,
                usedUnit: usage.usedTokens,
                walletBalance: (await walletRef.once('value')).val().balanceTokens,
                canChat
            };
        }

        return res.json({
            response: initialMessage,
            studentInfo: {
                name: studentName,
                level: rawLevel,
                unit: rawUnit,
                fullContent
            },
            chatHistory: conversations[userId],
            tokenInfo
        });

    } catch (error) {
        console.error(`❌ Erro em /api/start: ${error.message}`);
        console.error(error.stack);
        return res.status(500).json({
            error: "Erro ao inicializar a conversa.",
            details: error.message
        });
    }
});

// ======================
// /api/chat
// ======================
app.post('/api/chat', async (req, res) => {
    const { uid: userId, message: userMessage, level, unit } = req.body;
    
    if (!userId || !userMessage) {
        return res.status(400).json({ 
            response: "User ID and message required.",
            error: "MISSING_PARAMS"
        });
    }

    try {
        console.log(`[POST /api/chat] User: ${userId}, Message: "${userMessage.substring(0, 50)}..."`);
        
        // Se não existir contexto (edge case: chamaram /api/chat antes do /api/start)
        if (!conversations[userId] || conversations[userId].length === 0) {
            console.log(`[INFO] Criando contexto fallback para usuário: ${userId}`);
            const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
            const studentName = nameSnap.exists() ? nameSnap.val() : "Student";
            const fallbackLevel = level || "Level1";
            const fallbackUnit = unit || "Unit1";
            
            const { topic, fullContent } = await loadConversationDetails(fallbackLevel, fallbackUnit);
            const context = createInitialContext(studentName, fallbackLevel, fallbackUnit, topic, fullContent);
            
            conversations[userId] = [
                context, 
                { studentName, studentLevel: fallbackLevel, studentUnit: fallbackUnit },
                { role: 'assistant', content: `Hello ${studentName}! Let's begin our conversation.` }
            ];
        }

        // Valida e limpa o histórico
        validateAndTrimHistory(userId);
        
        // Recupera level/unit do contexto se não vier no body
        const meta = conversations[userId]?.[1] || {};
        const studentLevel = level || meta.studentLevel || "Level1";
        const studentUnit = unit || meta.studentUnit || "Unit1";
        
        // Adiciona mensagem do usuário
        conversations[userId].push({ role: 'user', content: userMessage.trim() });

        // ------- TOKENS: PRECHECK -------
        let tokenInfo = {};
        let usageRef, walletRef;
        
        if (TOKENS_CONTROL_ENABLED) {
            usageRef = db.ref(`usage/${userId}/${studentLevel}/${studentUnit}`);
            walletRef = db.ref(`wallet/${userId}`);

            // Garante usage caso não exista (ex.: entrou por /api/chat direto)
            let usageSnap = await usageRef.once('value');
            if (!usageSnap.exists()) {
                const capKey = normalizeLevelForCap(studentLevel);
                const unitCap = tokenConfig.unitCaps[capKey] || 1000;
                await usageRef.set({
                    unitCap,
                    allowedTokens: unitCap,
                    usedTokens: 0,
                    remainingTokens: unitCap,
                    minSessionReserve: tokenConfig.minSessionReserve,
                    createdAt: Date.now()
                });
                usageSnap = await usageRef.once('value');
            }

            const usage = usageSnap.val();
            const wallet = (await walletRef.once('value')).val() || { balanceTokens: 0 };

            // Estimativa conservadora: ~80 input + maxOut output
            const estimated = 80 + tokenConfig.maxOut;
            
            if ((usage.remainingTokens || 0) < estimated) {
                return res.json({
                    response: "You reached your token limit for this unit. Please complete other activities or come back later.",
                    chatHistory: conversations[userId],
                    tokenInfo: {
                        remainingUnit: usage.remainingTokens || 0,
                        walletBalance: wallet.balanceTokens || 0,
                        canChat: false
                    }
                });
            }
        }

        // ------- OPENAI -------
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini-2024-07-18',
            messages: conversations[userId],
            max_tokens: tokenConfig.maxOut,
        });

        const responseMessage = completion.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
        conversations[userId].push({ role: 'assistant', content: responseMessage });

        // ------- TOKENS: DÉBITO -------
        if (TOKENS_CONTROL_ENABLED && completion.usage) {
            const totalUsed = completion.usage.total_tokens || 0;
            
            await usageRef.transaction(current => {
                if (!current) return current;
                current.usedTokens = (current.usedTokens || 0) + totalUsed;
                current.remainingTokens = Math.max(0, (current.allowedTokens || 0) - current.usedTokens);
                return current;
            });

            const updatedUsage = (await usageRef.once('value')).val();
            const updatedWallet = (await walletRef.once('value')).val() || { balanceTokens: 0 };
            
            tokenInfo = {
                remainingUnit: updatedUsage.remainingTokens,
                walletBalance: updatedWallet.balanceTokens,
                canChat: updatedUsage.remainingTokens > tokenConfig.minSessionReserve
            };
        }

        console.log(`[SUCCESS] Response generated for user: ${userId}`);
        return res.json({
            response: responseMessage,
            chatHistory: conversations[userId],
            usage: completion.usage,
            tokenInfo
        });

    } catch (error) {
        console.error(`❌ Erro em /api/chat: ${error.message}`);
        console.error(error.stack);
        
        // Remove a última mensagem do usuário em caso de erro
        if (conversations[userId] && conversations[userId].length > 0) {
            const lastMessage = conversations[userId][conversations[userId].length - 1];
            if (lastMessage.role === 'user') {
                conversations[userId].pop();
            }
        }
        
        return res.status(500).json({ 
            response: "Sorry, I encountered an error processing your message. Please try again.",
            error: "SERVER_ERROR",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ======================
// /api/tts
// ======================
app.post('/api/tts', async (req, res) => {
    try {
        const { text, speakingRate } = req.body;
        
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: "Texto inválido ou ausente." });
        }

        const request = {
            input: { text },
            voice: {
                languageCode: 'en-US',
                name: 'en-US-Standard-I',
                ssmlGender: 'MALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: speakingRate || 1.0
            },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        const audioContent = response.audioContent ? response.audioContent.toString('base64') : null;
        
        if (!audioContent) {
            return res.status(500).json({ error: "Falha ao gerar o áudio." });
        }

        return res.json({ audioContent });

    } catch (error) {
        console.error("[/api/tts] Erro:", error);
        return res.status(500).json({
            error: "Erro ao gerar áudio TTS.",
            details: error.message
        });
    }
});

// ======================
// Health Check
// ======================
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// ======================
// ROOT & START
// ======================
app.get('/', (_req, res) => {
    res.send("Servidor rodando com sucesso!");
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Controle de tokens: ${TOKENS_CONTROL_ENABLED ? 'ATIVADO' : 'DESATIVADO'}`);
});

module.exports = app;