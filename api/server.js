const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Configuração da API do OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Mensagem de contexto inicial
const contextMessage = {
    role: "system",
    content: `
        You will act as Lex, a friendly and patient English teacher robot. Your role is to conduct English lessons in a focused and motivating manner.
        Adapt your responses based on the student's age and English level. Use simpler language for younger or beginner students, and more advanced dialogue for older or more advanced students.
        Always introduce yourself as "Professor Lex" and address the student by name at the beginning of the conversation. Keep the conversation focused on the lesson topic.
    `,
};

// Lê o arquivo conversa.txt
function readConversaFile() {
    const filePath = path.join(__dirname, 'conversa.txt');
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { role: "system", content: `Student details:\n${content}` };
    } catch (error) {
        console.error("Error reading conversa.txt:", error);
        return { role: "system", content: "No student details provided." };
    }
}

// Endpoint para o chatbot
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ response: "Message cannot be empty." });
    }

    try {
        const studentDetails = readConversaFile(); // Lê as informações do aluno
        const messages = [
            contextMessage, // Contexto inicial
            studentDetails, // Informações do aluno
            { role: "user", content: userMessage }, // Mensagem do usuário
        ];

        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: messages,
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
