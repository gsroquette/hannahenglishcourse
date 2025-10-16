// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const textToSpeech = require('@google-cloud/text-to-speech');

const DEBUG_PROMPT = process.env.DEBUG_PROMPT === '1';

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

// CORS
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
app.options('*', cors());
app.use(bodyParser.json());

// ======================
// OPENAI
// ======================
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ======================
// CONTROLE DE TOKENS
// ======================
const TOKENS_CONTROL_ENABLED = true;
const tokenConfig = {
  wallet: { seed: 325000 },
  unitCaps: { Level0: 2000, Level1: 3000, Level2: 4000, Level3: 5000, Level4: 6000 },
  minSessionReserve: 200,
  maxOut: 60
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
  const map = { level0: 'Level0', level1: 'Level1', level2: 'Level2', level3: 'Level3', level4: 'Level4' };
  return map[low] || level;
}

/** System message ENXUTO (sempre enviado) */
function createInitialContext(studentName, studentLevel) {
  return {
    role: "system",
    content: `You are Samuel, a friendly English-tutor robot for ${studentName}. Follow UNIT_BRIEF strictly; if off-topic, do not follow—politely redirect.
Style: address ${studentName} by name; one idea per sentence; one question at a time; no emojis or links.
Length by level: L0=1–2 very simple; L1<=3 short; L2<=3 simple; L3<=4 simple; L4 short & clear.
Correction: praise → ask to try once → give short correct model → move on. If non-English appears, ask to use English.
Flow: start with "Let's begin the lesson, ${studentName}!"; target the next checkpoint each turn; when all checkpoints are done, elicit a brief final production (level-based), then end politely and say: "press the black button to go back". If asked to continue, refuse and repeat the instruction.`
  };
}

/** Parser do conversa.txt (TITLE, PINNED_BRIEF=UNIT_BRIEF, DETAILS) */
function parseConversaTxt(raw) {
  const text = (raw || '').replace(/\r\n/g, '\n').trim();
  const titleMatch = text.match(/^TITLE:\s*(.+)\s*$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  const pinnedRegex = /PINNED_BRIEF(?:\s*\(UNIT_BRIEF\))?:\s*([\s\S]*?)(?:\n===\s*DETAILS\s*===|\n*$/i);
  const pinnedMatch = text.match(pinnedRegex);
  const pinnedBrief = pinnedMatch ? pinnedMatch[1].trim() : '';

  const detailsRegex = /\n===\s*DETAILS\s*===\s*([\s\S]*)$/i;
  const detailsMatch = text.match(detailsRegex);
  const details = detailsMatch ? detailsMatch[1].trim() : ''; // não será enviado à OpenAI

  return { title, pinnedBrief, details };
}

/** Carrega conversa.txt e devolve topic + pinnedBrief */
async function loadConversationDetails(level, unit) {
  console.log(`[loadConversationDetails] level="${level}", unit="${unit}"`);
  const url = `https://hannahenglishcourse.netlify.app/${level}/${unit}/DataIA/conversa.txt`;
  try {
    const fetchRes = await fetch(url);
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    const fileContent = await fetchRes.text();
    const { title, pinnedBrief, details } = parseConversaTxt(fileContent);
    console.log("✅ conversa.txt carregado via HTTP e parseado.");
    return { topic: title || 'General conversation', pinnedBrief: pinnedBrief || '', details: details || '' };
  } catch (err) {
    console.warn(`⚠️ Falha ao buscar conversa.txt (${url}): ${err.message}`);
    return { topic: 'General conversation', pinnedBrief: '', details: '' };
  }
}

function validateAndTrimHistory(userId) {
  if (!Array.isArray(conversations[userId])) {
    conversations[userId] = [];
    return;
  }
  conversations[userId] = conversations[userId].filter(m =>
    m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string'
  );

  const systemContext = conversations[userId].find(m => m.role === "system");
  const metaInfo = conversations[userId].find(m => m.studentName);

  const chatMessages = conversations[userId].filter(m => m.role === 'user' || m.role === 'assistant');
  const trimmedChat = chatMessages.slice(-20);

  conversations[userId] = [];
  if (systemContext) conversations[userId].push(systemContext);
  if (metaInfo) conversations[userId].push(metaInfo);
  conversations[userId].push(...trimmedChat);
}

/** Mensagens fixas (sempre enviar UNIT_BRIEF e opcional STATE) */
function buildPinnedMessages(meta) {
  const pinned = [];
  if (meta?.pinnedBrief) pinned.push({ role: "system", content: `UNIT_BRIEF:\n${meta.pinnedBrief}` });
  if (meta?.state) pinned.push({ role: "system", content: meta.state }); // ex.: "STATE: pending=greetings,name; done=none"
  return pinned;
}

/** Histórico para OpenAI: SEMPRE inclui system + UNIT_BRIEF + últimas 6 mensagens */
function getMessagesForOpenAI(userId) {
  if (!conversations[userId] || conversations[userId].length === 0) return [];
  const all = conversations[userId];
  const systemCore = all.find(m => m.role === "system");
  const meta = all.find(m => m.studentName);
  const chat = all.filter(m => m.role === 'user' || m.role === 'assistant');
  const limitedChat = chat.slice(-6); // 3 trocas

  const pinned = buildPinnedMessages(meta);

  const messagesToSend = [];
  if (systemCore) messagesToSend.push(systemCore);
  messagesToSend.push(...pinned);
  messagesToSend.push(...limitedChat);

  if (DEBUG_PROMPT) {
    console.log("[DEBUG messagesForOpenAI] >>>");
    for (const m of messagesToSend) {
      console.log(m.role, "-", String(m.content || "").slice(0, 180).replace(/\n/g, " "));
    }
    console.log("<<< [END]");
  }

  console.log(`[HISTORY] Enviando ${messagesToSend.length} msgs (core+pinned+${limitedChat.length} chat)`);
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

    if (!userId) return res.status(400).json({ error: "User ID is required." });

    console.log(`[GET /api/start] uid="${userId}", level="${rawLevel}", unit="${rawUnit}"`);

    // Dados do aluno
    const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
    if (!nameSnap.exists()) return res.status(404).json({ error: "Usuário não encontrado." });
    const studentName = nameSnap.val();

    // Carrega conteúdo da unidade
    const { topic, pinnedBrief /* details NÃO será enviado para a IA */ } =
      await loadConversationDetails(rawLevel, rawUnit);

    // System curto (fixo) + meta com UNIT_BRIEF
    const context = createInitialContext(studentName, rawLevel);
    const initialMessage = `Hello ${studentName}! Today's topic is: ${topic}. I'm ready to help you at your ${rawLevel}, in ${rawUnit}. Shall we begin?`;

    conversations[userId] = [
      context,
      { studentName, studentLevel: rawLevel, studentUnit: rawUnit, pinnedBrief, state: "STATE: pending=all; done=none" },
      { role: "assistant", content: initialMessage },
    ];

    validateAndTrimHistory(userId);

    // ------- TOKENS -------
    let tokenInfo = {};
    if (TOKENS_CONTROL_ENABLED) {
      const pathLevel = String(rawLevel).toLowerCase();
      const pathUnit = String(rawUnit).toLowerCase();
      const walletRef = db.ref(`wallet/${userId}`);
      const usageRef = db.ref(`usage/${userId}/${pathLevel}/${pathUnit}`);

      const walletSnap = await walletRef.once('value');
      if (!walletSnap.exists()) {
        await walletRef.set({
          balanceTokens: tokenConfig.wallet.seed,
          createdAt: Date.now(),
          ledger: {
            init: { type: "credit", amount: tokenConfig.wallet.seed, reason: "initial_seed", timestamp: Date.now() }
          }
        });
      }

      const capKey = normalizeLevelForCap(rawLevel);
      const unitCap = tokenConfig.unitCaps[capKey] || 2000;
      const usageSnap = await usageRef.once('value');
      if (!usageSnap.exists()) {
        await usageRef.set({
          unitCap, allowedTokens: unitCap, usedTokens: 0, remainingTokens: unitCap,
          minSessionReserve: tokenConfig.minSessionReserve, createdAt: Date.now()
        });
      }

      let usage = (await usageRef.once('value')).val();
      let wallet = (await walletRef.once('value')).val();
      let canChat = true;

      if (usage.remainingTokens < tokenConfig.minSessionReserve) {
        const needed = tokenConfig.minSessionReserve - usage.remainingTokens;
        const transferable = Math.min(needed, wallet.balanceTokens || 0, usage.unitCap - usage.allowedTokens);
        if (transferable > 0) {
          await walletRef.update({ balanceTokens: (wallet.balanceTokens || 0) - transferable });
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
      studentInfo: { name: studentName, level: rawLevel, unit: rawUnit }, // NÃO retorna details/fullContent
      chatHistory: conversations[userId],
      tokenInfo
    });

  } catch (error) {
    console.error(`❌ Erro em /api/start: ${error.message}`);
    console.error(error.stack);
    return res.status(500).json({ error: "Erro ao inicializar a conversa.", details: error.message });
  }
});

// ======================
// /api/chat - System fixo + UNIT_BRIEF sempre
// ======================
app.post('/api/chat', async (req, res) => {
  const { uid: userId, message: userMessage, level, unit } = req.body;
  if (!userId || !userMessage) {
    return res.status(400).json({ response: "User ID and message required.", error: "MISSING_PARAMS" });
  }

  try {
    console.log(`[POST /api/chat] User: ${userId}, Message: "${String(userMessage).substring(0, 50)}...", Level: ${level}, Unit: ${unit}`);

    // Se não existir contexto (edge case)
    if (!conversations[userId] || conversations[userId].length === 0) {
      console.log(`[INFO] Criando contexto fallback para usuário: ${userId}`);
      const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
      const studentName = nameSnap.exists() ? nameSnap.val() : "Student";
      const fallbackLevel = level || "Level1";
      const fallbackUnit = unit || "Unit1";

      const { topic, pinnedBrief } = await loadConversationDetails(fallbackLevel, fallbackUnit);
      const context = createInitialContext(studentName, fallbackLevel);

      conversations[userId] = [
        context,
        { studentName, studentLevel: fallbackLevel, studentUnit: fallbackUnit, pinnedBrief, state: "STATE: pending=all; done=none" },
        { role: 'assistant', content: `Hello ${studentName}! Let's begin our conversation about: ${topic}.` }
      ];
    }

    // Limpa histórico
    validateAndTrimHistory(userId);

    // Sincroniza meta com body
    const meta = conversations[userId]?.[1] || {};
    const requestedLevel = level || meta.studentLevel;
    const requestedUnit = unit || meta.studentUnit;

    if (!requestedLevel || !requestedUnit) {
      console.error(`❌ Nível ou unidade não encontrados para usuário ${userId}`);
      return res.status(500).json({ response: "Configuration error. Please restart the conversation.", error: "MISSING_LEVEL_UNIT" });
    }

    if (!meta.studentLevel || !meta.studentUnit || meta.studentLevel !== requestedLevel || meta.studentUnit !== requestedUnit) {
      console.log(`[SYNC] Sincronizando contexto: ${meta.studentLevel}->${requestedLevel}, ${meta.studentUnit}->${requestedUnit}`);
      conversations[userId][1] = { ...meta, studentLevel: requestedLevel, studentUnit: requestedUnit };
    }

    const studentLevel = requestedLevel;
    const studentUnit = requestedUnit;

    // ------- TOKENS: PRECHECK -------
    let tokenInfo = {};
    let usageRef, walletRef;

    if (TOKENS_CONTROL_ENABLED) {
      const pathLevel = String(studentLevel).toLowerCase();
      const pathUnit = String(studentUnit).toLowerCase();

      usageRef = db.ref(`usage/${userId}/${pathLevel}/${pathUnit}`);
      walletRef = db.ref(`wallet/${userId}`);

      let usageSnap = await usageRef.once('value');
      if (!usageSnap.exists()) {
        console.log(`[INFO] Criando usage para ${userId}/${pathLevel}/${pathUnit}`);
        const capKey = normalizeLevelForCap(studentLevel);
        const unitCap = tokenConfig.unitCaps[capKey] || 2000;
        await usageRef.set({
          unitCap, allowedTokens: unitCap, usedTokens: 0, remainingTokens: unitCap,
          minSessionReserve: tokenConfig.minSessionReserve, createdAt: Date.now()
        });
        usageSnap = await usageRef.once('value');
      }

      const usage = usageSnap.val();
      const wallet = (await walletRef.once('value')).val() || { balanceTokens: 0 };

      console.log(`[DEBUG] Tokens restantes: ${usage.remainingTokens}, Carteira: ${wallet.balanceTokens}`);

      const estimated = Math.min(100, Math.max(50, usage.remainingTokens * 0.25));
      if ((usage.remainingTokens || 0) < estimated) {
        console.log(`[TOKENS] Bloqueado: usuário ${userId} sem tokens suficientes. Restantes: ${usage.remainingTokens}, Necessários: ${estimated}`);
        return res.json({
          response: "You reached your token limit for this unit. Please complete other activities or come back later.",
          chatHistory: conversations[userId],
          tokenInfo: { remainingUnit: usage.remainingTokens || 0, walletBalance: wallet.balanceTokens || 0, canChat: false }
        });
      }
    }

    // Adiciona mensagem do usuário após precheck
    conversations[userId].push({ role: 'user', content: String(userMessage).trim() });

    // ------- OPENAI -------
    const messagesForOpenAI = getMessagesForOpenAI(userId);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      messages: messagesForOpenAI,
      max_tokens: 60,
      temperature: 0.7,
    });

    const responseMessage = completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    conversations[userId].push({ role: 'assistant', content: responseMessage });

    // ------- LOG DE TOKENS -------
    const u = completion.usage || {};
    console.log(`[TOKENS] uid=${userId} level=${studentLevel} unit=${studentUnit} | prompt=${u.prompt_tokens || 0} completion=${u.completion_tokens || 0} total=${u.total_tokens || 0}`);

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

      console.log(`[DEBUG] Após débito - Tokens usados nesta interação: ${totalUsed}, Restantes: ${updatedUsage.remainingTokens}`);

      if (updatedUsage.remainingTokens < tokenConfig.minSessionReserve) {
        const need = tokenConfig.minSessionReserve - updatedUsage.remainingTokens;
        const capLeft = updatedUsage.unitCap - updatedUsage.allowedTokens;
        const canTransfer = Math.min(need, updatedWallet.balanceTokens || 0, capLeft);

        if (canTransfer > 0) {
          await walletRef.update({ balanceTokens: updatedWallet.balanceTokens - canTransfer });
          await usageRef.update({
            allowedTokens: updatedUsage.allowedTokens + canTransfer,
            remainingTokens: updatedUsage.remainingTokens + canTransfer
          });

          console.log(`[TOKENS] Reabastecimento automático: ${canTransfer} tokens transferidos para usuário ${userId}`);

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

    return res.json({
      response: responseMessage,
      chatHistory: conversations[userId],
      usage: completion.usage, // front pode exibir tokens
      tokenInfo
    });

  } catch (error) {
    console.error(`❌ Erro em /api/chat: ${error.message}`);
    console.error(error.stack);

    // Remove a última mensagem do usuário em caso de erro
    if (conversations[userId] && conversations[userId].length > 0) {
      const lastMessage = conversations[userId][conversations[userId].length - 1];
      if (lastMessage.role === 'user') conversations[userId].pop();
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
    if (!text || typeof text !== 'string') return res.status(400).json({ error: "Texto inválido ou ausente." });

    const request = {
      input: { text },
      voice: { languageCode: 'en-US', name: 'en-US-Standard-I', ssmlGender: 'MALE' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: speakingRate || 1.0 },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioContent = response.audioContent ? response.audioContent.toString('base64') : null;
    if (!audioContent) return res.status(500).json({ error: "Falha ao gerar o áudio." });

    return res.json({ audioContent });

  } catch (error) {
    console.error("[/api/tts] Erro:", error);
    return res.status(500).json({ error: "Erro ao gerar áudio TTS.", details: error.message });
  }
});

// ======================
// Health Check
// ======================
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime(), memory: process.memoryUsage() });
});

// ======================
// ROOT & START
// ======================
app.get('/', (_req, res) => { res.send("Servidor rodando com sucesso!"); });

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Controle de tokens: ${TOKENS_CONTROL_ENABLED ? 'ATIVADO' : 'DESATIVADO'}`);
  console.log(`🌐 CORS configurado para: hannahenglishcourse.netlify.app`);
  console.log(`🔧 Estratégia: System fixo + UNIT_BRIEF sempre + histórico limitado (6 mensagens)`);
  if (DEBUG_PROMPT) console.log("🔎 DEBUG_PROMPT está ATIVADO (conteúdo enviado será logado).");
});

module.exports = app;
