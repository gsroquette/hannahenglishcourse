// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const textToSpeech = require('@google-cloud/text-to-speech');

const BUILD_VERSION = "2025-10-16-v6-topic-state+logs+meta-fix";
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
  wallet: { seed: 1600000 }, // atualizado
  unitCaps: {               // atualizados
    Level0: 8000,
    Level1: 12000,
    Level2: 16000,
    Level3: 20000,
    Level4: 24000
  },
  minSessionReserve: 200,
  maxOut: 60
};

// ======================
// ESTADO EM MEMÓRIA
// ======================
const conversations = {};
const MAX_HISTORY_MSGS = 4; // 2 trocas

// ======================
// HELPERS
// ======================
function normalizeLevelForCap(level) {
  if (!level) return 'Level1';
  const low = String(level).toLowerCase();
  const map = { level0: 'Level0', level1: 'Level1', level2: 'Level2', level3: 'Level3', level4: 'Level4' };
  return map[low] || level;
}

/** System compact */
function createInitialContext(studentName, studentLevel) {
  return {
    role: "system",
    content: `You are Samuel, a friendly, patient, encouraging robot.
Help ${studentName} practice English at level ${studentLevel}, call the student by name, not before asking their name.
Follow UNIT_BRIEF goals strictly, one by one in order.
Ask one question per goal.
Do not add, skip, or change any topic.
After finishing all goals:
congratulate, say goodbye, tell the student they are ready for the next stage, ask to press the black button to exit, then stop talking.
Language by CEFR level:
L0 (Pre-A1, young beginners) – 1–2 very short simple sentences
L1 (A1) – ≤3 short sentences
L2 (A2) – ≤3 simple sentences
L3 (B1) – ≤4 simple connected sentences
L4 (B2) – short, clear sentences
Speak only English.

If ${studentName} uses another language, ask politely to speak in English.
Use text only (no emojis, links, or images).
Feedback:
Praise correct answers.
For mistakes → show correct form, encourage, ask to retry.
If still wrong → say “Good try! You’re improving!” and move to next goal.
If ${studentName} goes off-topic, redirect gently to UNIT_BRIEF.
Never change topic yourself.
Act as a step-by-step tutor: follow goals, stay on topic and in English, give kind feedback, and end when the last goal is done.`
  };
}

/** Parser conversa.txt */
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

// ======================
// ESTADO DINÂMICO POR TÓPICOS (SEM GATILHOS)
// ======================
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'goal';
}

function parseGoalsFromPinnedBrief(pinnedBrief) {
  const lines = String(pinnedBrief || '').split('\n');
  const goals = [];

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('goals') && l.includes('order')) { start = i; break; }
  }
  if (start === -1) {
    console.warn("[BRIEF/PARSE] 'Goals (in this order)' não encontrado.");
    console.log("[BRIEF/PARSE] conteúdo do PINNED_BRIEF (primeiras linhas):", lines.slice(0, 10));
    return goals;
  }

  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    const lower = raw.toLowerCase();
    if (
      lower.startsWith('language bank') ||
      lower.startsWith('at the end') ||
      lower.startsWith('then ') ||
      lower.startsWith('exit') ||
      lower.startsWith('success') ||
      lower.startsWith('materials') ||
      lower.startsWith('tips') ||
      lower.startsWith('notes') ||
      lower.startsWith('=== ')
    ) break;

    if (!/^\s*(\d+[\.)]|[-–•])\s+/.test(raw)) break;

    const itemText = raw.replace(/^\s*(\d+[\.)]|[-–•])\s+/, '');
    const head = itemText.split(/[—–-]/)[0].split('(')[0].trim();
    const id = slugify(head);

    goals.push({ id, label: head, raw });
  }

  console.log("[BRIEF/PARSE] found goals:", goals.map(g => g.label));
  return goals;
}

function buildDynamicMetaFromBrief(studentName, studentLevel, studentUnit, pinnedBrief) {
  let goals = parseGoalsFromPinnedBrief(pinnedBrief);

  if (!goals || goals.length === 0) {
    const fallback = ['Greetings', 'Name', 'Feelings', 'Likes', 'Mini self-introduction'];
    goals = fallback.map(label => ({ id: slugify(label), label, raw: label }));
    console.warn("[BRIEF/PARSE] usando fallback de goals:", fallback);
  }

  const ids = goals.map(g => g.id);
  const next = ids[0] || '';
  const remaining = ids.slice(1).join(',');

  const meta = {
    studentName, studentLevel, studentUnit,
    pinnedBrief,
    goals,
    goalMap: Object.fromEntries(goals.map(g => [g.id, g])),
    state: `STATE: next=${next}; remaining=${remaining}; done=`,
    loopGuard: { next: next || "", tries: 0, hint: "" }
  };

  console.log("[STATE/INIT] goals:", meta.goals.map(g => g.label));
  console.log("[STATE/INIT] state:", meta.state);

  return meta;
}

function updateStateTopic(meta /*, userText = "" */) {
  if (!meta || !meta.state) return;
  const m = (meta.state || "").match(/STATE:\s*next=([^;]*);\s*remaining=([^;]*);\s*done=(.*)$/i);
  if (!m) return;

  let next = (m[1] || '').trim();
  let remaining = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
  let done = (m[3] || '').split(',').map(s => s.trim()).filter(Boolean);

  if (!next) {
    meta.state = `STATE: next=; remaining=${remaining.join(',')}; done=${done.join(',')}`;
    return;
  }

  if (!done.includes(next)) done.push(next);

  remaining = remaining.filter(r => r !== next);
  const upcoming = remaining[0] || "";

  meta.loopGuard = { next: upcoming, tries: 0, hint: "" };
  next = upcoming;

  meta.state = `STATE: next=${next}; remaining=${remaining.join(',')}; done=${done.join(',')}`;
}

/** Carrega conversa.txt remoto (topic + pinnedBrief) */
async function loadConversationDetails(level, unit) {
  const url = `https://hannahenglishcourse.netlify.app/${level}/${unit}/DataIA/conversa.txt`;
  console.log(`[loadConversationDetails] GET ${url}`);
  try {
    const fetchRes = await safeFetch(url);
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    const fileContent = await fetchRes.text();
    const { title, pinnedBrief, details } = parseConversaTxt(fileContent);
    console.log("✅ conversa.txt carregado e parseado. TITLE:", title);
    return { topic: title || 'General conversation', pinnedBrief: pinnedBrief || '', details: details || '' };
  } catch (err) {
    console.warn(`⚠️ Falha ao buscar conversa.txt (${url}): ${err.message}`);
    return { topic: 'General conversation', pinnedBrief: '', details: '' };
  }
}

/** Sanitiza e limita histórico — preserva system + meta */
function validateAndTrimHistory(userId) {
  const arr = Array.isArray(conversations[userId]) ? conversations[userId] : [];

  // 1) Preserve system e meta ANTES de filtrar
  const systemContext = arr.find(m => m && m.role === "system" && typeof m.content === "string");
  const metaInfo = arr.find(m => m && typeof m === "object" && m.studentName); // meta não tem role

  // 2) Filtre só as mensagens de chat
  const chatMessages = arr.filter(m =>
    m && typeof m === "object" &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string'
  );
  const trimmedChat = chatMessages.slice(-MAX_HISTORY_MSGS);

  // 3) Reconstrua preservando system + meta
  const rebuilt = [];
  if (systemContext) rebuilt.push(systemContext);
  if (metaInfo)     rebuilt.push(metaInfo);
  rebuilt.push(...trimmedChat);

  conversations[userId] = rebuilt;
}

/** Mensagens fixas para a IA */
function buildPinnedMessages(meta) {
  const arr = [];
  if (meta?.pinnedBrief) {
    const brief = String(meta.pinnedBrief).trim();
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

function getMessagesForOpenAI(userId) {
  if (!conversations[userId] || conversations[userId].length === 0) return [];
  const all = conversations[userId];

  const systemCore = all.find(m => m.role === "system");

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
  if (meta) {
    console.log("[PROMPT] NEXT =", meta.loopGuard?.next || "(none)");
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
    if (!userId) return res.status(400).json({ error: "User ID é obrigatório." });

    console.log(`[GET /api/start] uid="${userId}", level="${rawLevel}", unit="${rawUnit}"`);

    const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
    if (!nameSnap.exists()) return res.status(404).json({ error: "Usuário não encontrado." });
    const studentName = nameSnap.val();

    const { topic, pinnedBrief } = await loadConversationDetails(rawLevel, rawUnit);

    const context = createInitialContext(studentName, rawLevel);
    const meta = buildDynamicMetaFromBrief(studentName, rawLevel, rawUnit, pinnedBrief);

    const initialMessage = `Hello ${studentName}! Today's topic is: ${topic}. I'm ready to help you at your ${rawLevel}, in ${rawUnit}. Shall we begin?`;

    conversations[userId] = [
      context,
      meta,
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
      const meta = buildDynamicMetaFromBrief(studentName, fallbackLevel, fallbackUnit, pinnedBrief);

      conversations[userId] = [
        context,
        meta,
        { role: 'assistant', content: `Hello ${studentName}! Let's begin our conversation about: ${topic}.` }
      ];
    }

    validateAndTrimHistory(userId);

    // BLINDAGEM: se o meta sumiu, reconstruir
    let meta = conversations[userId]?.[1];
    if (!meta || !meta.state) {
      console.warn("[META] ausente ou sem state — reconstruindo a partir do brief.");
      const levelEff = level || "Level1";
      const unitEff  = unit  || "Unit1";
      const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
      const studentName = nameSnap.exists() ? nameSnap.val() : "Student";
      const { pinnedBrief } = await loadConversationDetails(levelEff, unitEff);
      meta = buildDynamicMetaFromBrief(studentName, levelEff, unitEff, pinnedBrief);

      const systemMsg = conversations[userId].find(m => m.role === "system") || createInitialContext(studentName, levelEff);
      const chatMsgs  = conversations[userId].filter(m => m.role === 'user' || m.role === 'assistant');
      conversations[userId] = [systemMsg, meta, ...chatMsgs.slice(-MAX_HISTORY_MSGS)];
    }

    // Sincroniza meta (nível/unidade)
    const requestedLevel = level || meta.studentLevel;
    const requestedUnit = unit || meta.studentUnit;
    if (!requestedLevel || !requestedUnit) {
      console.error(`❌ Nível ou unidade não encontrados para usuário ${userId}`);
      return res.status(500).json({ response: "Configuration error. Please restart the conversation.", error: "MISSING_LEVEL_UNIT" });
    }
    if (!meta.studentLevel || !meta.studentUnit || meta.studentLevel !== requestedLevel || meta.studentUnit !== requestedUnit) {
      console.log(`[SYNC] Meta: ${meta.studentLevel}->${requestedLevel}, ${meta.studentUnit}->${requestedUnit}`);
      conversations[userId][1] = { ...meta, studentLevel: requestedLevel, studentUnit: requestedUnit };
      meta = conversations[userId][1];
    }

    // ------- TOKENS: PRECHECK -------
    let tokenInfo = {};
    let usageRef, walletRef;

    if (TOKENS_CONTROL_ENABLED) {
      const pathLevel = String(requestedLevel).toLowerCase();
      const pathUnit = String(requestedUnit).toLowerCase();

      usageRef = db.ref(`usage/${userId}/${pathLevel}/${pathUnit}`);
      walletRef = db.ref(`wallet/${userId}`);

      let usageSnap = await usageRef.once('value');
      if (!usageSnap.exists()) {
        console.log(`[INFO] Criando usage para ${userId}/${pathLevel}/${pathUnit}`);
        const capKey = normalizeLevelForCap(requestedLevel);
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

    // Adiciona mensagem do aluno e AVANÇA por tópico
    const userMsgTrimmed = String(userMessage).trim();
    console.log("[CHAT] user message:", userMsgTrimmed);
    console.log("[STATE/BEFORE] state:", conversations[userId]?.[1]?.state);
    conversations[userId].push({ role: 'user', content: userMsgTrimmed });

    updateStateTopic(conversations[userId]?.[1]);

    console.log("[STATE/AFTER] state:", conversations[userId]?.[1]?.state);
    console.log("[STATE/NEXT] next goal:", conversations[userId]?.[1]?.loopGuard?.next || "(none)");

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
    console.log(`[TOKENS] uid=${userId} lvl=${requestedLevel} unit=${requestedUnit} | prompt=${u.prompt_tokens||0} completion=${u.completion_tokens||0} total=${u.total_tokens||0}`);

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

    const trimmed = String(text).trim();
    if (!trimmed) {
      console.warn("[TTS] texto vazio/espaço — ignorado");
      return res.status(200).json({ audioContent: null });
    }

    console.log("[TTS] len:", trimmed.length, "rate:", speakingRate || 1.0);

    const request = {
      input: { text: trimmed },
      voice: { languageCode: 'en-US', name: 'en-US-Standard-I', ssmlGender: 'MALE' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: speakingRate || 1.0 },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioContent = response.audioContent ? response.audioContent.toString('base64') : null;
    if (!audioContent) {
      console.error("[TTS] Falha ao gerar áudio: audioContent null/undefined");
      return res.status(500).json({ error: "Falha ao gerar o áudio." });
    }

    return res.json({ audioContent });

  } catch (error) {
    console.error("[TTS] erro:", error?.message);
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
  console.log(`🔧 Estratégia: System fixo + UNIT_BRIEF + STATE por tópicos (sem gatilhos) + histórico limitado (${MAX_HISTORY_MSGS} msgs)`);
  if (DEBUG_PROMPT) console.log("🔎 DEBUG_PROMPT ATIVADO (conteúdo enviado será logado).");
});

module.exports = app;
