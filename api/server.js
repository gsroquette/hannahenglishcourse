const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000; // Porta dinâmica para Render ou outros ambientes

app.use(cors());
app.use(bodyParser.json());

// Configuração da API do OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY, // Certifique-se de que esta variável está definida corretamente no Render
});
const openai = new OpenAIApi(configuration);

// Endpoint para receber mensagens do frontend
app.post('/server', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ response: "Mensagem não fornecida. Por favor, envie um campo 'message' no corpo da requisição." });
    }

    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{ role: "user", content: userMessage }],
        });

        const responseMessage = completion.data.choices[0].message.content;
        res.json({ response: responseMessage });
    } catch (error) {
        console.error("Erro na API OpenAI:", error.message || error);

        if (error.response) {
            // Se a OpenAI retornar um erro específico
            console.error("Detalhes do erro:", error.response.data);
            return res.status(error.response.status).json({
                response: `Erro na OpenAI: ${error.response.data.error.message}`,
            });
        }

        res.status(500).json({ response: "Desculpe, algo deu errado ao processar sua mensagem." });
    }
});

// Endpoint de teste para garantir que o servidor está funcionando
app.get('/', (req, res) => {
    res.send('Servidor rodando com sucesso no Render!');
});

// Iniciando o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
