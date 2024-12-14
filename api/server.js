const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*', // Permitir todas as origens
}));
app.use(bodyParser.json());

// Configuração da API do OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Carregar informações do arquivo conversa.txt
let conversationDetails = 'General conversation'; // Valor padrão
try {
    const filePath = path.join(__dirname, 'conversa.txt'); // Caminho correto
    if (fs.existsSync(filePath)) {
        conversationDetails = fs.readFileSync(filePath, 'utf-8').trim();
    } else {
        console.error("Arquivo conversa.txt não encontrado. Usando valor padrão.");
    }
} catch (error) {
    console.error("Erro ao carregar conversa.txt:", error);
}

// Mensagem de contexto inicial
const contextMessage = {
    role: "system",
    content: `
        You will act as Lex, a native American, friendly, and patient robot. Your goal is to help the student, a 19-year-old, practice English conversation in a focused, cheerful, and motivating way. Her English level is Level1, and the current lesson topic is: ${conversationDetails}.

        Follow these guidelines to conduct the conversation:

        Adapt your language to the student's level:
        - If the level is Level1, use short sentences (a maximum of 3 per interaction), simple, clear, and direct. Avoid being verbose.
        - If the level is Level2, use short sentences (a maximum of 5 per interaction), while keeping them simple and clear. Avoid being verbose.

        Focus on the topic:
        - Keep the conversation always centered on the lesson topic and avoid distractions.
        - If the student speaks in another language, politely ask him to switch back to English.

        Introduction and interaction:
        - Always introduce yourself as "Lex" at the beginning and address the student by her name.
        - Praise correct answers and encourage the student even when she makes mistakes.

        Correction and support:
        - Correct grammar and language usage mistakes in a friendly and motivating way.
        - If you receive a nonsensical response or fail to understand something, assume it could be a pronunciation error. Help the student to fix and improve her speech.

        Clarity and objectivity:
        - Maintain a positive and encouraging tone throughout the interaction.
        - Avoid long or complex sentences.
        - Keep the learning experience light, friendly, and productive!
    `,
};

// Rota para iniciar a conversa
app.get('/api/start', (req, res) => {
    const studentInfo = {
        name: "Vera",
        age: 19,
        level: "Level1",
    };

    const topic = conversationDetails || "a general topic";
    const initialMessage = `Hello ${studentInfo.name}! My name is Lex, your robot friend. Today's topic is: ${topic}. Shall we begin?`;

    res.json({
        response: initialMessage, // Mensagem inicial exibida no front-end
        studentInfo,              // Dados do aluno
    });
});

// Array para manter o histórico da conversa
const chatHistory = [contextMessage];

app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ response: "Message cannot be empty." });
    }

    try {
        // Adicionar mensagem do usuário ao histórico
        chatHistory.push({ role: 'user', content: userMessage });

        // Fazer a chamada para a API OpenAI com o histórico completo
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: chatHistory,
        });

        const responseMessage = completion.data.choices[0].message.content;

        // Adicionar a resposta do robô ao histórico
        chatHistory.push({ role: 'assistant', content: responseMessage });

        res.json({ response: responseMessage });
    } catch (error) {
        console.error("Erro na API OpenAI:", error);
        res.status(500).json({ response: "Error processing the message." });
    }
});

// Rota para teste
app.get('/', (req, res) => {
    res.send("Servidor rodando com sucesso no Vercel!");
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
