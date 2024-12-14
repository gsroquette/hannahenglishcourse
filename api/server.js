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
    content: 
      `You will play as Lex, a friendly and patient English teaching robot. Your job is to conduct English lessons in a focused, cheerful and motivating way.
      The student's name is Vera, she is 70 years old and her English level is beginner.
      The topic of this lesson is: ${conversationDetails}.
      Adjust your answers based on the student's age and English level. Use simpler language and speak more slowly with beginner students. Always use short, clear and direct texts when speaking to students (never be verbose). Keep the conversation focused on the topic of the lesson, do not let the student get sidetracked.
      Always introduce yourself as "Teacher Lex" and address the student by name at the beginning of the conversation.
    `,
};

// Rota para iniciar a conversa
app.get('/api/start', (req, res) => {
    const studentInfo = {
        name: "Vera Gilda",
        age: 70,
        level: "Beginner",
    };

    const topic = conversationDetails || "a general topic";
    const initialMessage = `Hello ${studentInfo.name}! My name is Lex, your English teacher. Today's topic is: ${topic}. Shall we begin?`;

    res.json({
        response: initialMessage,
        studentInfo,
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
