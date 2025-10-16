// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const textToSpeech = require('@google-cloud/text-to-speech');

const BUILD_VERSION = "2025-10-16-antilook-v3-dynamic-state";
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
// CONSTANTES DE ECONOMIA (histórico curto)
// ======================
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

/** System compact+ anti-loop (sem termos técnicos) — sem truncamento */
function createInitialContext(studentName, studentLevel) {
  return {
    role: "system",
    content: `You are Samuel, a friendly, patient, and encouraging robot.
Always respond in simple, natural English appropriate to level ${studentLevel}.
Help ${studentName} practice English at level ${studentLevel}, always addressing ${studentName} by name.
Keep the conversation focused on UNIT_BRIEF. Use only words from the UNIT_BRIEF Language Bank (unless echoing ${studentName}'s exact words).

Conversation rules:
- One idea per sentence.
- Ask only one question at a time.
- No teaching jargon or meta comments (do not mention "lesson/unit/level/rules").
- Text only (no emojis, no links).

When finished, congratulate, say goodbye, and tell ${studentName} he/she is ready for the next stage. Then stop.
If ${studentName} insists, politely decline and say: "press the black button to go back".

Adapt your language:
• Level 0: 1–2 very simple sentences. For young beginners.
• Level 1 (A1): up to 2–3 short sentences.
• Level 2 (A2): up to 3 simple sentences.
• Level 3 (B1): up to 4 simple sentences.
• Level 4 (B2): short, clear sentences.

If ${studentName} uses another language, ask to speak in English.
Praise correct answers; for mistakes, ask to try again; if the error continues, show the correct form in ONE short line, encourage ("Good try! You’re improving!"), and move on.

If ${studentName} goes off-topic, briefly redirect and ask a new question about the current topic from the UNIT_BRIEF.`
  };
}

/** Parser do conversa.txt (TITLE / PINNED_BRIEF / DETAILS) */
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
// ESTADO DINÂMICO A PARTIR DO PINNED_BRIEF
// ======================

/** Slug simples e robusto */
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"')  // aspas curvas → "
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remover acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'goal';
}

/** Extrai frases entre aspas (curvas ou retas) para usar como gatilhos */
function extractQuotedPhrases(text) {
  const res = new Set();
  const s = String(text || '');

  // aspas curvas “...”
  const reCurly = /“([^”]+)”/g;
  let m;
  while ((m = reCurly.exec(s)) !== null) res.add(m[1].trim());

  // aspas retas "..."
  const reStraight = /"([^"]+)"/g;
  while ((m = reStraight.exec(s)) !== null) res.add(m[1].trim());

  // casos simples: Hello!, Good morning!, etc. (sem aspas mas com !)
  const exclam = s.match(/\b([A-Z][a-z]+(?: [a-z]+)*)!\b/g);
  if (exclam) exclam.forEach(p => res.add(p.replace(/!+$/, '').trim()));

  return Array.from(res).filter(Boolean);
}

/** Tenta localizar a seção "Goals (in this order)" e seus itens numerados */
function parseGoalsFromPinnedBrief(pinnedBrief) {
  const lines = String(pinnedBrief || '').split('\n');
  const goals = [];

  // encontrar o índice da linha "Goals" (aceita variações)
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('goals') && l.includes('order')) { start = i; break; }
  }
  if (start === -1) return goals;

  // coletar linhas subsequentes que pareçam itens (começam com número/bullet)
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) {
      // linha em branco: pode marcar fim da lista (mas toleramos blocos com espaços)
      // vamos continuar até encontrar outra seção típica
      continue;
    }
    // parar se começarmos outra seção comum
    const lower = raw.toLowerCase();
    if (
      lower.startsWith('language bank') ||
      lower.startsWith('at the end') ||
      lower.startsWith('then ') ||
      lower.startsWith('exit') ||
      lower.startsWith('success') ||
      lower.startsWith('materials') ||
      lower.startsWith('tips') ||
      lower.startsWith('notes')
    ) break;

    // item se começar com "1." / "1)" / "-" / "•"
    if (!/^\s*(\d+[\.)]|[-–•])\s+/.test(raw)) {
      // pode ser que os itens estejam sem numerador — paramos quando algo não bater com padrão
      // mas se a linha tem ":", ainda pode ser a cabeça do item
      if (!raw.includes(':')) break;
    }

    // extrai "título" do objetivo (parte antes de "(" ou "—")
    const itemText = raw.replace(/^\s*(\d+[\.)]|[-–•])\s+/, '');
    const head = itemText.split(/[—–-]/)[0].split('(')[0].trim();
    const id = slugify(head);

    // gatilhos por aspas no item inteiro
    const triggers = extractQuotedPhrases(raw);

    goals.push({
      id,
      label: head,
      raw: raw,
      triggers
    });
  }

  // fallback: se não achou nada, retorna vazio; o chamador decide como tratar
  return goals;
}

/** Constroi meta dinâmico a partir do brief: goals, estado, triggers normalizados */
function buildDynamicMetaFromBrief(studentName, studentLevel, studentUnit, pinnedBrief) {
  // 1) parse goals do brief
  let goals = parseGoalsFromPinnedBrief(pinnedBrief);

  // 2) fallback elegante se brief não listar objetivos
  if (!goals || goals.length === 0) {
    // padrão minimalista — ainda dinâmico (ids pelo rótulo)
    const fallback = [
      { label: 'Greetings', triggers: ['Hello', 'Good morning', 'Good night'] },
      { label: 'Name', triggers: ['My name is'] },
      { label: 'Feelings', triggers: ['I am happy', 'I am sad'] },
      { label: 'Likes', triggers: ['I like'] },
      { label: 'Self-introduction', triggers: ['Hello! My name is', 'I am happy', 'I like'] },
    ];
    goals = fallback.map(g => ({ id: slugify(g.label), label: g.label, raw: g.label, triggers: g.triggers }));
  }

  // 3) normaliza triggers em regex simples (case-insensitive, contém)
  const triggerMap = {};
  goals.forEach(g => {
    const arr = Array.isArray(g.triggers) ? g.triggers : [];
    triggerMap[g.id] = arr
      .map(t => String(t || '').trim())
      .filter(Boolean)
      .map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')); // match por “contém”
  });

  // 4) estado inicial dinâmico
  const ids = goals.map(g => g.id);
  const next = ids[0] || '';
  const remaining = ids.slice(1).join(',');

  // 5) meta que será guardada em conversations[userId][1]
  return {
    studentName, studentLevel, studentUnit,
    pinnedBrief,
    goals,                       // array na ordem
    goalMap: Object.fromEntries(goals.map(g => [g.id, g])),
    triggers: triggerMap,        // id -> [regex...]
    state: `STATE: next=${next}; remaining=${remaining}; done=`,
    loopGuard: { next: next || "", tries: 0, hint: "" }
  };
}

/** Atualiza STATE/loop de forma dinâmica com base nos gatilhos do objetivo atual */
function updateStateDynamic(meta, userText = "") {
  if (!meta || !meta.state) return;

  // extrair next/remaining/done do STATE textual
  const m = (meta.state || "").match(/STATE:\s*next=([^;]*);\s*remaining=([^;]*);\s*done=(.*)$/i);
  if (!m) return;
  let next = (m[1] || '').trim();
  let remaining = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
  let done = (m[3] || '').split(',').map(s => s.trim()).filter(Boolean);

  // garantir loopGuard
  if (!meta.loopGuard) meta.loopGuard = { next: next || "", tries: 0, hint: "" };
  const lg = meta.loopGuard;

  // se não há "next" (acabaram os objetivos), não faz nada
  if (!next) {
    meta.state = `STATE: next=; remaining=${remaining.join(',')}; done=${done.join(',')}`;
    return;
  }

  const text = String(userText || '');
  const rexs = meta.triggers?.[next] || [];

  // HIT: se qualquer trigger do objetivo atual aparecer na fala do aluno
  const hit = rexs.length > 0 ? rexs.some(rx => rx.test(text)) : false;

  if (hit) {
    if (!done.includes(next)) done.push(next);
    remaining = remaining.filter(r => r !== next);
    const upcoming = remaining[0] || "";
    meta.loopGuard = { next: upcoming, tries: 0, hint: "" };
    next = upcoming;
  } else {
    const sameGoal = lg.next === (next || "");
    lg.tries = sameGoal ? (lg.tries + 1) : 1;
    lg.next = next || lg.next;

    if (lg.tries >= 2 && next) {
      // Após 2 tentativas: dar modelo e avançar
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

/** Carrega conversa.txt remoto (topic + pinnedBrief) */
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

/** Sanitiza e limita histórico (mantém system + meta + últimas 2 trocas) */
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
  const trimmedChat = chatMessages.slice(-MAX_HISTORY_MSGS);

  conversations[userId] = [];
  if (systemContext) conversations[userId].push(systemContext);
  if (metaInfo) conversations[userId].push(metaInfo);
  conversations[userId].push(...trimmedChat);
}

/** Monta mensagens fixas (UNIT_BRIEF completo + STATE + loopGuard) */
function buildPinnedMessages(meta) {
  const arr = [];
  if (meta?.pinnedBrief) {
    const brief = String(meta.pinnedBrief).trim(); // sem truncamento
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

/** Histórico para OpenAI: system + UNIT_BRIEF + últimas N mensagens (sem truncar conteúdos) */
function getMessagesForOpenAI(userId) {
  if (!conversations[userId] || conversations[userId].length === 0) return [];
  const all = conversations[userId];

  // system (sem truncamento)
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

    // Fallback de contexto (se perder na memória do servidor)
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

    // Sincroniza meta (nível/unidade)
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

    // Adiciona mensagem do aluno e atualiza STATE dinâmico
    conversations[userId].push({ role: 'user', content: String(userMessage).trim() });
    updateStateDynamic(conversations[userId]?.[1], userMessage);

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
  console.log(`🔧 Estratégia: System fixo + UNIT_BRIEF dinâmico + STATE/loopGuard dinâmicos por unidade + histórico limitado (${MAX_HISTORY_MSGS} msgs)`);
  if (DEBUG_PROMPT) console.log("🔎 DEBUG_PROMPT ATIVADO (conteúdo enviado será logado).");
});

module.exports = app;
