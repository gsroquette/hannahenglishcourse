const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuração da OpenAI API
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY, // Substituir pela variável de ambiente no Vercel
});
const openai = new OpenAIApi(configuration);

// Endpoint para comunicação
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{ role: "user", content: userMessage }],
        });

        const responseMessage = completion.data.choices[0].message.content;
        res.json({ response: responseMessage });
    } catch (error) {
        console.error("Erro na API OpenAI:", error.response?.data || error.message);
        res.status(500).json({ response: "Desculpe, houve um erro ao processar sua mensagem." });
    }
});

module.exports = app;
