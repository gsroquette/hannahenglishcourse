const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000; // Porta dinâmica para compatibilidade com o Render

app.use(cors());
app.use(express.json()); // Middleware nativo para interpretar JSON

// Configuração da API do OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY, // Chave de API definida como variável de ambiente no Render
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

// Adicionando endpoint de teste para garantir resposta na raiz
app.get('/', (req, res) => {
    res.send('Servidor rodando com sucesso no Render!');
});

// Iniciando o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
