const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Defina o caminho correto do index
const indexPath = path.join(__dirname, '../../Atividades/LEX/index.html');

// Configure a OpenAI API Key
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.get('/', (req, res) => {
    res.sendFile(indexPath); // Envia o arquivo index.html como resposta
});

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{ role: "user", content: userMessage }],
        });

        const responseMessage = completion.data.choices[0].message.content;
        res.json({ response: responseMessage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ response: "Desculpe, algo deu errado!" });
    }
});

// Inicia o servidor
app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});
