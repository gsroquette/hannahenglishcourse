const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Configuração da API do OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
console.log("Chave da OpenAI:", process.env.OPENAI_API_KEY); // Verifique no log
const openai = new OpenAIApi(configuration);

// Endpoint para o chatbot
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ response: "Mensagem não pode estar vazia." });
    }

    try {
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: [{ role: 'user', content: userMessage }],
        });

        const responseMessage = completion.data.choices[0].message.content;
        res.json({ response: responseMessage });
    } catch (error) {
        console.error("Erro na API OpenAI:", error.response ? error.response.data : error.message);
        res.status(500).json({ response: "Erro ao processar a mensagem." });
    }
});

// Rota para teste
app.get('/', (req, res) => {
    res.send("Servidor rodando com sucesso no Vercel!");
});

module.exports = app;
