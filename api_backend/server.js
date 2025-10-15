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

console.log("GOOGLE_TTS_SERVICE_ACCOUNT:", process.env.GOOGLE_TTS_SERVICE_ACCOUNT ? "DEFINIDO" : "NÃO DEFINIDO");
const ttsCredentials = JSON.parse(process.env.GOOGLE_TTS_SERVICE_ACCOUNT || '{}');
const ttsClient = new textToSpeech.TextToSpeechClient({ credentials: ttsCredentials });

// ===================================
//  CONFIGURAÇÃO FIREBASE ADMIN
// ===================================
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
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===================================
//  CONFIGURAÇÃO DE TOKENS
// ===================================
const TOKENS_CONTROL_ENABLED = true;

const tokenConfig = {
  wallet: { seed: 325000 },
  unitCaps: { Level0: 1000, Level1: 2000, Level2: 3000, Level3: 4000, Level4: 5000 },
  minSessionReserve: 300,
  maxOut: 120
};

// ===================================
//  ARMAZENAMENTO EM MEMÓRIA
// ===================================
const conversations = {};

// ===================================
//  FUNÇÕES AUXILIARES
// ===================================

function createInitialContext(studentName, studentLevel, studentUnit, conversationDetails, conversationFullContent) {
  return {
    role: "system",
    content: `
You are Samuel, a friendly, patient, and motivating virtual robot.
Help ${studentName} practice English, always addressing him/her by name.
They are at ${studentLevel} level.
Keep the conversation centered on ${conversationFullContent}.

Start by saying: "Let's begin the lesson, ${studentName}!" and begin the class.
After covering all of ${conversationFullContent}, thank, congratulate, and say goodbye, affirming that he/she is ready for the next stage. Then, stop interacting. If the student insists, politely refuse and ask to go to the next class and say: press the black button to go back.

Adapt the language according to the level (CEFR):
Level 0: little children, 1–2 very simple sentences.
Level 1 (A1): up to 3 short sentences.
Level 2 (A2): up to 3 simple sentences.
Level 3 (B1): up to 4 simple sentences.
Level 4 (B2): slightly longer but clear sentences.

Interaction Tips:
Keep responses short and to the point.
If the student speaks another language, gently ask them to use English.
Praise correct answers. If there’s a mistake, ask them to try again once. If the error persists, provide the correct form, encourage them, and move on.
Text only (no emojis).
`
  };
}

// Lê conversa.txt da unidade
async function loadConversationDetails(level, unit) {
  console.log(`[loadConversationDetails] level="${level}", unit="${unit}"`);
  const url = `https://hannahenglishcourse.netlify.app/${level}/${unit}/DataIA/conversa.txt`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const fileContent = await response.text();
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const topic = lines[0]?.trim() || 'General conversation';
    const sanitizedContent = fileContent.replace(/###|\d+\.\s/g, '').trim();
    console.log("✅ conversa.txt carregado com sucesso via HTTP.");
    return { topic, fullContent: sanitizedContent };
  } catch (err) {
    console.warn(`⚠️ Falha ao buscar conversa.txt: ${err.message}`);
    return { topic: 'General conversation', fullContent: '' };
  }
}

function validateAndTrimHistory(userId) {
  if (!Array.isArray(conversations[userId])) conversations[userId] = [];
  conversations[userId] = conversations[userId].filter(m => m?.role && m?.content);
  if (conversations[userId].length > 20) conversations[userId] = conversations[userId].slice(-20);
}

// ===================================
//  ENDPOINT /api/start
// ===================================
app.get('/api/start', async (req, res) => {
  try {
    const userId = req.query.uid;
    const studentLevel = req.query.level || "Level1";
    const studentUnit = req.query.unit || "Unit1";
    if (!userId) return res.status(400).json({ error: "User ID is required." });

    console.log(`[GET /api/start] userId="${userId}", level="${studentLevel}", unit="${studentUnit}"`);

    const { topic, fullContent } = await loadConversationDetails(studentLevel, studentUnit);
    const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
    if (!nameSnap.exists()) return res.status(404).json({ error: "Usuário não encontrado." });
    const studentName = nameSnap.val();

    const context = createInitialContext(studentName, studentLevel, studentUnit, topic, fullContent);
    const initialMessage = `Hello ${studentName}! Today's topic is: ${topic}. I'm ready to help you at your ${studentLevel}, in ${studentUnit}. Shall we begin?`;
    conversations[userId] = [context, { studentName, studentLevel, studentUnit }, { role: "assistant", content: initialMessage }];
    validateAndTrimHistory(userId);

    // 🔹 TOKEN CONTROL
    let tokenInfo = {};
    if (TOKENS_CONTROL_ENABLED) {
      const walletRef = db.ref(`wallet/${userId}`);
      const usageRef = db.ref(`usage/${userId}/${studentLevel}/${studentUnit}`);
      const walletSnap = await walletRef.once('value');
      const usageSnap = await usageRef.once('value');

      if (!walletSnap.exists()) {
        await walletRef.set({
          balanceTokens: tokenConfig.wallet.seed,
          createdAt: Date.now(),
          ledger: { init: { type: "credit", amount: tokenConfig.wallet.seed, reason: "initial_seed", timestamp: Date.now() } }
        });
      }

      if (!usageSnap.exists()) {
        const unitCap = tokenConfig.unitCaps[studentLevel] || 1000;
        await usageRef.set({
          unitCap, allowedTokens: unitCap, usedTokens: 0,
          remainingTokens: unitCap, minSessionReserve: tokenConfig.minSessionReserve,
          createdAt: Date.now(), ledger: {}
        });
      }

      const usage = (await usageRef.once('value')).val();
      const wallet = (await walletRef.once('value')).val();
      let canChat = true;

      if (usage.remainingTokens < tokenConfig.minSessionReserve) {
        const needed = tokenConfig.minSessionReserve - usage.remainingTokens;
        const transferable = Math.min(needed, wallet.balanceTokens, usage.unitCap - usage.allowedTokens);
        if (transferable > 0) {
          await walletRef.update({ balanceTokens: wallet.balanceTokens - transferable });
          await usageRef.update({
            allowedTokens: usage.allowedTokens + transferable,
            remainingTokens: usage.remainingTokens + transferable
          });
        } else canChat = false;
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
      studentInfo: { name: studentName, level: studentLevel, unit: studentUnit, fullContent },
      chatHistory: conversations[userId],
      tokenInfo
    });
  } catch (error) {
    console.error(`❌ Erro em /api/start: ${error.message}`);
    res.status(500).json({ error: "Erro ao inicializar a conversa.", details: error.message });
  }
});

// ===================================
//  ENDPOINT /api/chat
// ===================================
app.post('/api/chat', async (req, res) => {
  const { uid: userId, message: userMessage, level, unit } = req.body;
  if (!userId || !userMessage) return res.status(400).json({ response: "User ID and message required." });

  try {
    if (!conversations[userId]) {
      const nameSnap = await db.ref(`usuarios/${userId}/nome`).once('value');
      const studentName = nameSnap.exists() ? nameSnap.val() : "Student";
      const studentLevel = level || "Level1";
      const studentUnit = unit || "Unit1";
      const { topic, fullContent } = await loadConversationDetails(studentLevel, studentUnit);
      const context = createInitialContext(studentName, studentLevel, studentUnit, topic, fullContent);
      conversations[userId] = [context];
    }

    validateAndTrimHistory(userId);
    conversations[userId].push({ role: 'user', content: userMessage });

    // 🔹 TOKEN PRE-CHECK
    let usageRef, usage, walletRef, wallet;
    if (TOKENS_CONTROL_ENABLED) {
      const studentLevel = level || "Level1";
      const studentUnit = unit || "Unit1";
      usageRef = db.ref(`usage/${userId}/${studentLevel}/${studentUnit}`);
      walletRef = db.ref(`wallet/${userId}`);
      usage = (await usageRef.once('value')).val();
      wallet = (await walletRef.once('value')).val();

      const estimated = 80 + tokenConfig.maxOut;
      if (usage.remainingTokens < estimated) {
        return res.json({
          response: "You reached your token limit for this unit.",
          chatHistory: conversations[userId],
          tokenInfo: {
            remainingUnit: usage.remainingTokens,
            walletBalance: wallet.balanceTokens,
            canChat: false
          }
        });
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      messages: conversations[userId],
    });
    const responseMessage = completion.choices[0].message.content;
    conversations[userId].push({ role: 'assistant', content: responseMessage });

    // 🔹 TOKEN DEBIT
    let tokenInfo = {};
    if (TOKENS_CONTROL_ENABLED && completion.usage) {
      const totalUsed = completion.usage.total_tokens;
      await usageRef.transaction(current => {
        if (!current) return current;
        current.usedTokens += totalUsed;
        current.remainingTokens = Math.max(0, current.allowedTokens - current.usedTokens);
        return current;
      });
      const updatedUsage = (await usageRef.once('value')).val();
      const updatedWallet = (await walletRef.once('value')).val();
      tokenInfo = {
        remainingUnit: updatedUsage.remainingTokens,
        walletBalance: updatedWallet.balanceTokens,
        canChat: updatedUsage.remainingTokens > tokenConfig.minSessionReserve
      };
    }

    res.json({
      response: responseMessage,
      chatHistory: conversations[userId],
      usage: completion.usage,
      tokenInfo
    });

  } catch (error) {
    console.error(`❌ Erro em /api/chat: ${error.message}`);
    res.status(500).json({ response: "Erro ao processar a mensagem.", details: error.message });
  }
});

// ===================================
//  ENDPOINT /api/tts (Google TTS)
// ===================================
app.post('/api/tts', async (req, res) => {
  try {
    const { text, speakingRate } = req.body;
    if (!text || typeof text !== 'string')
      return res.status(400).json({ error: "Texto inválido ou ausente." });

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
    res.status(500).json({ error: "Erro ao gerar áudio TTS.", details: error.message });
  }
});

// ===================================
//  TESTE E START
// ===================================
app.get('/', (req, res) => res.send("Servidor rodando com sucesso!"));
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
module.exports = app;
