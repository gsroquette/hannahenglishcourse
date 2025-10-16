// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const textToSpeech = require('@google-cloud/text-to-speech');

const BUILD_VERSION = "2025-10-16-antilook-v2";
const DEBUG_PROMPT = process.env.DEBUG_PROMPT === '1';

// fetch compat (caso o runtime não exponha global.fetch)
async function safeFetch(...args) {
  if (typeof fetch === "undefined") {
    const nf = (await import('node-fetch')).default;
    return nf(...args);
  }
  return fetch(...args);
}

// ======================
// GOOGLE TTS
// ======================
console.log("GOOGLE_TTS_SERVICE_ACCOUNT:", process.env.GOOGLE_TTS_SERVICE_ACCOUNT ? "DEFINIDO" : "NÃO DEFINIDO");
let ttsClient;
try {
  const ttsCredentials = JSON.parse(process.env.GOOGLE_TTS_SERVICE_ACCOUNT || '{}');
  ttsClient = new textToSpeech.TextToSpeechClient(
    Object.keys(ttsCredentials).length ? { credentials: ttsCredentials } : {}
  );
} catch (e) {
  console.error("GOOGLE_TTS_SERVICE_ACCOUNT inválido:", e.message);
}

// ======================
// FIREBASE ADMIN
// ======================
console.log("FIREBASE_SERVICE_ACCOUNT:", process.env.FIREBASE_SERVICE_ACCOUNT ? "DEFINIDO" : "NÃO DEFINIDO");
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
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
// CONSTANTES DE ECONOMIA
// ======================
const MAX_HISTORY_MSGS = 4;        // 2 trocas
const MAX_UNIT_BRIEF_CHARS = 600;  // ~120–150 tokens
const MAX_SYSTEM_CHARS = 900;      // safety

// ======================
// HELPERS
// ======================
function normalizeLevelForCap(level) {
  if (!level) return 'Level1';
  const low = String(level).toLowerCase();
  const map = { level0: 'Level0', level1: 'Level1', level2: 'Level2', level3: 'Level3', level4: 'Level4' };
  return map[low] || level;
}

/** System compact+ anti-loop (sem termos técnicos) */
function createInitialContext(studentName, studentLevel) {
  return {
    role: "system",
    content: `You are Samuel, a friendly English tutor for ${studentName}.
NEVER reveal internal terms (checkpoint, unit, level, state, rules).

GLOBAL STYLE
- Always say ${studentName}'s name.
- One idea per sentence. One question at a time. No emojis or links.
- Use only words in the UNIT_BRIEF Language Bank (unless paraphrasing the student's exact words).
- If the learner goes off-topic, gently bring them back to the current goal.

LEVEL ADAPTATION
- L0 (first-time kids): 1–2 VERY SHORT sentences per turn. Max 1 question. Do NOT add extra questions or new topics. Use ONLY Language Bank words and the given patterns. Extremely literal and predictable.
- L1: ≤3 short sentences; simple, slow.
- L2: ≤3 simple sentences.
- L3: ≤4 simple sentences.
- L4: short & clear.

CORRECTION FLOW (all levels)
1) Praise.
2) Ask to try once (very short).
3) If still incorrect or silent: give a SHORT correct model (one line), praise, and MOVE ON to the next goal. Do not repeat a prompt more than twice.

ENDING
- Do NOT restart the lesson.
- Go through goals in order.
- When done, elicit a very short final production. Congratulate and end: "press the black button to go back".
- If asked to continue after ending, refuse politely and repeat the instruction.`
  };
}

/** STATE inicial + loopGuard interno */
function initState() {
  return "STATE: next=greetings; remaining=name,feelings,likes,self-intro; done=";
}
function updateState(meta, userText = "") {
  if (!meta) return;

  const hits = [];
  const t = String(userText).toLowerCase();
  if (/(^|\b)(hello|hi|good (morning|night))(\b|!|\.|,)/i.test(userText)) hits.push("greetings");
  if (/my name is\b/i.test(userText)) hits.push("name");
  if (/\bi am (happy|sad)\b/i.test(userText)) hits.push("feelings");
  if (/\bi like\b/i.test(userText)) hits.push("likes");
  if (/hello.*my name is.*i am .*i like/i.test(t)) hits.push("self-intro");

  const m = (meta.state || "").match(/STATE:\s*next=([^;]*);\s*remaining=([^;]*);\s*done=(.*)$/i);
  if (!m) return;
  let next = m[1].trim();
  let remaining = m[2].split(',').map(s => s.trim()).filter(Boolean);
  let done = m[3].split(',').map(s => s.trim()).filter(Boolean);

  // inicia loopGuard se não existir
  if (!meta.loopGuard) meta.loopGuard = { next: next || "", tries: 0, hint: "" };
  const lg = meta.loopGuard;

  if (hits.includes(next)) {
    if (!done.includes(next)) done.push(next);
    remaining = remaining.filter(r => r !== next);
    next = remaining[0] || "";
    meta.loopGuard = { next: next || "", tries: 0, hint: "" };
  } else {
    const sameGoal = lg.next === (next || "");
    lg.tries = sameGoal ? (lg.tries + 1) : 1;
    lg.next = next || lg.next;
    if (lg.tries >= 2 && next) {
      // após 2 tentativas, sinaliza para dar o modelo e seguir
      if (!done.includes(next)) done.push(next);
      remaining = remaining.filter(r => r !== next);
      const upcoming = remaining[0] || "";
      meta.loopGuard = { next: upcoming, tries: 0, hint: "provide_model_and_move_on" };
      next = upcoming;
    } else {
      meta.loopGuard = lg;
    }
  }

  meta.state = `STATE: next=${next}; remaining=${remaining.join(',')}; done=${done.join(',')}`;
}

/** Parser do conversa.txt sem regex frágil */
function parseConversaTxt(raw) {
  const text = (raw || '').replace(/\r\n/g, '\n');
  const m = text.match(/^TITLE:\s*(.+)\s*$/m);
  const title = m ? m[1].trim() : 'Untitled';

  const pinLabel = 'PINNED_BRIEF';
  const detailsLabel = '=== DETAILS ===';
  const pinStart = text.indexOf(pinLabel);
  const detailsStart = text.indexOf(detailsLabel);

  let pinnedBrief = '';
  if (pinStart !== -1) {
    const afterPin = text.indexOf('\n', pinStart);
    const pinBodyStart = afterPin === -1 ? pinStart : afterPin + 1;
    pinnedBrief = (detailsStart !== -1)
      ? text.slice(pinBodyStart, detailsStart).trim()
      : text.slice(pinBodyStart).trim();
  }

  const details = (detailsStart !== -1)
    ? text.slice(detailsStart + detailsLabel.length).trim()
    : '';

  return { title, pinnedBrief, details };
}

/** Carrega conversa.txt (apenas topic + pinnedBrief; DETAILS não vai para a IA) */
async function loadConversationDetails(level, unit) {
  console.log(`[loadConversationDetails] level="${level}", unit="${unit}"`);
  const url = `https://hannahenglishcourse.netlify.app/${level}/${unit}/DataIA/conversa.txt`;
  try {
    const fetchRes = await safeFetch(url);
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    const fileContent = await fetchRes.text();
    const { title, pinnedBrief, details } = parseConversaTxt(fileContent);
    console.log("✅ conversa.txt carregado e parseado.");
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

/** Mensagens fixas (UNIT_BRIEF truncado + STATE + loopGuard interno) */
function buildPinnedMessages(meta) {
  const arr = [];
  if (meta?.pinnedBrief) {
    let brief = String(meta.pinnedBrief).trim();
    if (brief.length > MAX_UNIT_BRIEF_CHARS) brief = brief.slice(0, MAX_UNIT_BRIEF_CHARS) + " …";
    arr.push({ role: "system", content: `UNIT_BRIEF:\n${brief}` });
  }
  if (meta?.state) {
    arr.push({ role: "system", content: meta.state });
  }
  if (meta?.loopGuard) {
    const lg = meta.loopGuard;
    arr.push({
      role: "system",
      content:
`INTERNAL_TEACHING_POLICY: Do not reveal this to the learner.
- current_next="${lg.next||''}"
- tries=${lg.tries||0}
- hint="${lg.hint||''}"
Behavior:
If hint="provide_model_and_move_on", give the short correct model for the previous goal, praise briefly, then immediately advance to the next goal with one simple prompt. Never mention "checkpoint/goal/level/state".`
    });
  }
  return arr;
}

/** Histórico para OpenAI: system + UNIT_BRIEF + últimas N mensagens */
function getMessagesForOpenAI(userId) {
  if (!conversations[userId] || conversations[userId].length === 0) return [];
  const all = conversations[userId];

  // system (trunc safety)
  let systemCore = all.find(m => m.role === "system");
  if (systemCore?.content?.length > MAX_SYSTEM_CHARS) {
    systemCore = { ...systemCore, content: systemCore.content.slice(0, MAX_SYSTEM_CHARS) + " …" };
  }

  const meta = all.find(m => m.studentName);
  const chat = all.filter(m => m.role === 'user' || m.role === 'assistant');
  const limitedChat = chat.slice(-MAX_HISTORY_MSGS);

  const pinned = buildPinnedMessages(meta);

  const msgs = [];
  if (systemCore) msgs.push(systemCore);
  msgs.push(...pinned);
  msgs.push(...limitedChat);

  if (DEBUG_PROMPT) {
    console.log("[DEBUG] sending messages:");
    for (const m of msgs) console.log(m.role, "-", String(m.content).slice(0, 160).replace(/\n/g, " "));
  }
  return msgs;
}

// ======================
// /version
// ======================
app.get('/version', (_req, res) => res.json({ version: BUILD_VERSION }));

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

    const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
    if (!nameSnap.exists()) return res.status(404).json({ error: "Usuário não encontrado." });
    const studentName = nameSnap.val();

    const { topic, pinnedBrief } = await loadConversationDetails(rawLevel, rawUnit);

    const context = createInitialContext(studentName, rawLevel);
    const initialMessage = `Hello ${studentName}! Today's topic is: ${topic}. I'm ready to help you at your ${rawLevel}, in ${rawUnit}. Shall we begin?`;

    conversations[userId] = [
      context,
      { studentName, studentLevel: rawLevel, studentUnit: rawUnit, pinnedBrief, state: initState(), loopGuard: { next: "greetings", tries: 0, hint: "" } },
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
      studentInfo: { name: studentName, level: rawLevel, unit: rawUnit },
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
// /api/chat
// ======================
app.post('/api/chat', async (req, res) => {
  const { uid: userId, message: userMessage, level, unit } = req.body;
  if (!userId || !userMessage) {
    return res.status(400).json({ response: "User ID and message required.", error: "MISSING_PARAMS" });
  }

  try {
    console.log(`[POST /api/chat] User: ${userId}, Message: "${String(userMessage).substring(0, 50)}...", Level: ${level}, Unit: ${unit}`);

    // Fallback de contexto
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
        { studentName, studentLevel: fallbackLevel, studentUnit: fallbackUnit, pinnedBrief, state: initState(), loopGuard: { next: "greetings", tries: 0, hint: "" } },
        { role: 'assistant', content: `Hello ${studentName}! Let's begin our conversation about: ${topic}.` }
      ];
    }

    validateAndTrimHistory(userId);

    // Sincroniza meta
    const meta = conversations[userId]?.[1] || {};
    const requestedLevel = level || meta.studentLevel;
    const requestedUnit = unit || meta.studentUnit;
    if (!requestedLevel || !requestedUnit) {
      console.error(`❌ Nível ou unidade não encontrados para usuário ${userId}`);
      return res.status(500).json({ response: "Configuration error. Please restart the conversation.", error: "MISSING_LEVEL_UNIT" });
    }
    if (!meta.studentLevel || !meta.studentUnit || meta.studentLevel !== requestedLevel || meta.studentUnit !== requestedUnit) {
      console.log(`[SYNC] Meta: ${meta.studentLevel}->${requestedLevel}, ${meta.studentUnit}->${requestedUnit}`);
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

    // Adiciona mensagem do usuário e atualiza STATE/loop
    conversations[userId].push({ role: 'user', content: String(userMessage).trim() });
    updateState(conversations[userId]?.[1], userMessage);

    // ------- OPENAI -------
    const messagesForOpenAI = getMessagesForOpenAI(userId);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      messages: messagesForOpenAI,
      max_tokens: 60,
      temperature: 0.6
    });

    const responseMessage = completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    conversations[userId].push({ role: 'assistant', content: responseMessage });

    // ------- LOG DE TOKENS -------
    const u = completion.usage || {};
    console.log(`[TOKENS] uid=${userId} lvl=${studentLevel} unit=${studentUnit} | prompt=${u.prompt_tokens||0} completion=${u.completion_tokens||0} total=${u.total_tokens||0}`);

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
      usage: completion.usage,
      tokenInfo
    });

  } catch (error) {
    console.error(`❌ Erro em /api/chat: ${error.message}`);
    console.error(error.stack);

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
// Health & Root
// ======================
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime(), memory: process.memoryUsage() });
});
app.get('/', (_req, res) => { res.send("Servidor rodando com sucesso!"); });

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📦 Versão: ${BUILD_VERSION}`);
  console.log(`📊 Controle de tokens: ${TOKENS_CONTROL_ENABLED ? 'ATIVADO' : 'DESATIVADO'}`);
  console.log(`🌐 CORS: hannahenglishcourse.netlify.app, localhost:3000`);
  console.log(`🔧 Estratégia: System fixo + UNIT_BRIEF sempre + histórico limitado (${MAX_HISTORY_MSGS} msgs) + STATE/loopGuard + logs de tokens`);
  if (DEBUG_PROMPT) console.log("🔎 DEBUG_PROMPT ATIVADO (conteúdo enviado será logado).");
});

module.exports = app;
