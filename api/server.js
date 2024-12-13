const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configure a OpenAI API Key
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY, // Variável de ambiente configurada no Vercel
});
const openai = new OpenAIApi(configuration);

// Endpoint para receber mensagens do frontend
app.post('/server', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{ role: "user", content: userMessage }],
        });

        const responseMessage = completion.data.choices[0].message.content;
        res.json({ response: responseMessage });
    } catch (error) {
        console.error("Erro na API OpenAI:", error);
        res.status(500).json({ response: "Desculpe, algo deu errado ao processar sua mensagem." });
    }
});

// Exporta o app como módulo serverless
module.exports = app;
