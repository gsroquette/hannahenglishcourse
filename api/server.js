const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Configuração da API do OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Carregar informações do arquivo conversa.txt
let conversationDetails = '';
try {
    conversationDetails = fs.readFileSync('./conversa.txt', 'utf-8');
} catch (error) {
    console.error("Erro ao carregar conversa.txt:", error);
}

// Rota para iniciar a conversa
app.get('/api/start', (req, res) => {
    const initialMessage = `Hello! My name is Lex, your great English teacher. Today's topic is: ${conversationDetails}. Shall we begin?`;
    res.json({ response: initialMessage });
});

// Rota para o chatbot
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: [{ role: 'user', content: userMessage }],
        });

        const responseMessage = completion.data.choices[0].message.content;
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

module.exports = app;
