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

// CORREÇÃO DO CORS - Configuração mais específica
app.use(cors({
    origin: [
        'https://hannahenglishcourse.netlify.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middleware para lidar com requisições OPTIONS (preflight)
app.options('*', cors());

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
        Level0: 2000,  // Aumentado
        Level1: 3000,  // Aumentado  
        Level2: 4000,  // Aumentado
        Level3: 5000,  // Aumentado
        Level4: 6000   // Aumentado
    },
    minSessionReserve: 200,  // Reduzido
    maxOut: 60  // Reduzido significativamente para respostas mais curtas
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

// ESTRATÉGIA INTELIGENTE: Função para limitar histórico enviado para OpenAI
function getMessagesForOpenAI(userId) {
    if (!conversations[userId] || conversations[userId].length === 0) {
        return [];
    }
    
    const allMessages = conversations[userId];
    
    // SEMPRE incluir system message (contexto essencial)
    const systemMessage = allMessages.find(msg => msg.role === "system");
    
    // Filtrar apenas user/assistant messages para histórico
    const chatMessages = allMessages.filter(msg => 
        msg.role === 'user' || msg.role === 'assistant'
    );
    
    // ESTRATÉGIA INTELIGENTE: Incluir system message apenas nas primeiras 3 trocas
    // (até ~6 mensagens de chat: user1 + assistant1 + user2 + assistant2 + user3 + assistant3)
    const shouldIncludeSystem = chatMessages.length <= 6;
    
    let messagesToSend = [];
    
    // Incluir system message quando necessário
    if (shouldIncludeSystem && systemMessage) {
        messagesToSend.push(systemMessage);
        console.log(`[HISTORY] Incluindo system message (chat messages: ${chatMessages.length})`);
    } else {
        console.log(`[HISTORY] Removendo system message (chat messages: ${chatMessages.length})`);
    }
    
    // ESTRATÉGIA 2: Limitar para últimas 8 mensagens de chat (4 trocas)
    const limitedChatMessages = chatMessages.slice(-8);
    
    // Combinar system message (se aplicável) + histórico limitado
    messagesToSend = [...messagesToSend, ...limitedChatMessages];
    
    console.log(`[HISTORY] Enviando ${messagesToSend.length} mensagens para OpenAI`);
    return messagesToSend;
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
            // Normalização das chaves para paths do Firebase
            const pathLevel = String(rawLevel).toLowerCase();
            const pathUnit = String(rawUnit).toLowerCase();
            
            const walletRef = db.ref(`wallet/${userId}`);
            const usageRef = db.ref(`usage/${userId}/${pathLevel}/${pathUnit}`);

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
            const unitCap = tokenConfig.unitCaps[capKey] || 2000;
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
                    console.log(`[TOKENS] Transferidos ${transferable} tokens da wallet para usage do usuário ${userId}`);
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
// /api/chat - VERSÃO CORRIGIDA COM ESTRATÉGIA INTELIGENTE
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
        console.log(`[POST /api/chat] User: ${userId}, Message: "${userMessage.substring(0, 50)}...", Level: ${level}, Unit: ${unit}`);
        
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
        
        // CORREÇÃO COM OPÇÃO A: PRIORIZAR os valores do body (frontend) e sincronizar com contexto
        const meta = conversations[userId]?.[1] || {};
        
        // OPÇÃO A: Usar level/unit do body (frontend) como fonte primária
        const requestedLevel = level || meta.studentLevel;
        const requestedUnit = unit || meta.studentUnit;
        
        if (!requestedLevel || !requestedUnit) {
            console.error(`❌ Nível ou unidade não encontrados para usuário ${userId}`);
            return res.status(500).json({ 
                response: "Configuration error. Please restart the conversation.",
                error: "MISSING_LEVEL_UNIT" 
            });
        }

        // Sincronizar contexto com os valores do frontend (se necessário)
        if (!meta.studentLevel || !meta.studentUnit || 
            meta.studentLevel !== requestedLevel || meta.studentUnit !== requestedUnit) {
            console.log(`[SYNC] Sincronizando contexto: ${meta.studentLevel}->${requestedLevel}, ${meta.studentUnit}->${requestedUnit}`);
            conversations[userId][1] = { 
                ...meta, 
                studentLevel: requestedLevel, 
                studentUnit: requestedUnit 
            };
        }

        const studentLevel = requestedLevel;
        const studentUnit = requestedUnit;

        console.log(`[INFO] Usando level: ${studentLevel}, unit: ${studentUnit} para usuário ${userId}`);

        // ------- TOKENS: PRECHECK -------
        let tokenInfo = {};
        let usageRef, walletRef;
        
        if (TOKENS_CONTROL_ENABLED) {
            // Normalização das chaves para paths do Firebase
            const pathLevel = String(studentLevel).toLowerCase();
            const pathUnit = String(studentUnit).toLowerCase();
            
            usageRef = db.ref(`usage/${userId}/${pathLevel}/${pathUnit}`);
            walletRef = db.ref(`wallet/${userId}`);

            // DEBUG: Log do path que está sendo usado
            console.log(`[DEBUG] Path do Firebase: usage/${userId}/${pathLevel}/${pathUnit}`);

            // Garante usage caso não exista (ex.: entrou por /api/chat direto)
            let usageSnap = await usageRef.once('value');
            if (!usageSnap.exists()) {
                console.log(`[INFO] Criando usage para ${userId}/${pathLevel}/${pathUnit}`);
                const capKey = normalizeLevelForCap(studentLevel);
                const unitCap = tokenConfig.unitCaps[capKey] || 2000;
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

            // DEBUG: Log do saldo atual
            console.log(`[DEBUG] Tokens restantes: ${usage.remainingTokens}, Carteira: ${wallet.balanceTokens}`);

            // CORREÇÃO: Estimativa mais conservadora - máximo 100 tokens ou 25% do saldo
            const estimated = Math.min(100, Math.max(50, usage.remainingTokens * 0.25));
            
            if ((usage.remainingTokens || 0) < estimated) {
                console.log(`[TOKENS] Bloqueado: usuário ${userId} sem tokens suficientes. Restantes: ${usage.remainingTokens}, Necessários: ${estimated}`);
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

        // Só adiciona a mensagem do usuário APÓS o precheck de tokens
        conversations[userId].push({ role: 'user', content: userMessage.trim() });

        // ------- OPENAI -------
        // ESTRATÉGIA INTELIGENTE: Usar função para limitar mensagens enviadas
        const messagesForOpenAI = getMessagesForOpenAI(userId);
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini-2024-07-18',
            messages: messagesForOpenAI,
            max_tokens: 60, // CORREÇÃO: Reduzido para respostas mais curtas
            temperature: 0.7,
        });

        const responseMessage = completion.choices[0].message?.content || "I'm sorry, I couldn't generate a response.";
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
            
            // DEBUG: Log após débito
            console.log(`[DEBUG] Após débito - Tokens usados: ${totalUsed}, Restantes: ${updatedUsage.remainingTokens}`);
            
            // Reabastecer da wallet também no /api/chat
            if (updatedUsage.remainingTokens < tokenConfig.minSessionReserve) {
                const need = tokenConfig.minSessionReserve - updatedUsage.remainingTokens;
                const capLeft = updatedUsage.unitCap - updatedUsage.allowedTokens;
                const canTransfer = Math.min(need, updatedWallet.balanceTokens || 0, capLeft);
                
                if (canTransfer > 0) {
                    await walletRef.update({ 
                        balanceTokens: updatedWallet.balanceTokens - canTransfer 
                    });
                    await usageRef.update({
                        allowedTokens: updatedUsage.allowedTokens + canTransfer,
                        remainingTokens: updatedUsage.remainingTokens + canTransfer
                    });
                    
                    console.log(`[TOKENS] Reabastecimento automático: ${canTransfer} tokens transferidos para usuário ${userId}`);
                    
                    // Atualiza os valores após transferência
                    const finalUsage = (await usageRef.once('value')).val();
                    const finalWallet = (await walletRef.once('value')).val() || { balanceTokens: 0 };
                    
                    tokenInfo = {
                        remainingUnit: finalUsage.remainingTokens,
                        walletBalance: finalWallet.balanceTokens,
                        canChat: finalUsage.remainingTokens > tokenConfig.minSessionReserve
                    };
                } else {
                    tokenInfo = {
                        remainingUnit: updatedUsage.remainingTokens,
                        walletBalance: updatedWallet.balanceTokens,
                        canChat: updatedUsage.remainingTokens > tokenConfig.minSessionReserve
                    };
                }
            } else {
                tokenInfo = {
                    remainingUnit: updatedUsage.remainingTokens,
                    walletBalance: updatedWallet.balanceTokens,
                    canChat: updatedUsage.remainingTokens > tokenConfig.minSessionReserve
                };
            }
        }

        console.log(`[SUCCESS] Response generated for user: ${userId} (Level: ${studentLevel}, Unit: ${studentUnit}) - Tokens used: ${completion.usage?.total_tokens || 'N/A'}`);
        return res.json({
            response: responseMessage,
            chatHistory: conversations[userId],
            usage: completion.usage,
            tokenInfo
        });

    } catch (error) {
        console.error(`❌ Erro em /api/chat: ${error.message}`);
        console.error(error.stack);
        
        // Remove a última mensagem do usuário em caso de erro (agora é seguro pois só foi adicionada após precheck)
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
    console.log(`🌐 CORS configurado para: hannahenglishcourse.netlify.app`);
    console.log(`🔧 ESTRATÉGIA INTELIGENTE: System message nas primeiras 3 trocas + Histórico limitado a 8 mensagens`);
});

module.exports = app;