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

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Contexto inicial fixo
const baseContextMessage = {
    role: "system",
    content: `
        You will act as Lex, a friendly and patient English teacher robot. Your role is to conduct English lessons in a focused and motivating manner.
        Adapt your responses based on the student's age and English level. Use simpler language for younger or beginner students, and more advanced dialogue for older or more advanced students.
        Introduce yourself as "Professor Lex" and address the student by name only in the first interaction. Keep subsequent responses focused on the lesson topic.
    `,
};

// Leitura do arquivo conversa.txt
function readConversaFile() {
    const filePath = path.join(__dirname, 'conversa.txt');
    try {
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        console.log("Content of conversa.txt:", content); // Log para depuração
        return { role: "system", content: `Student details:\n${content}` };
    } catch (error) {
        console.error("Error reading conversa.txt:", error.message);
        return { role: "system", content: "No student details provided." };
    }
}

// Variável para rastrear a primeira interação
let isFirstInteraction = true;

// Endpoint para o chatbot
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ response: "Message cannot be empty." });
    }

    try {
        const studentDetails = readConversaFile(); // Lê informações do aluno
        const messages = [
            baseContextMessage, // Contexto inicial fixo
            studentDetails, // Informações do aluno
        ];

        if (isFirstInteraction) {
            // Adiciona a introdução na primeira interação
            messages.push({ role: "system", content: "Introduce yourself to the student." });
            isFirstInteraction = false; // Marca que a introdução foi feita
        }

        // Adiciona a mensagem do usuário
        messages.push({ role: "user", content: userMessage });

        console.log("Messages sent to OpenAI:", JSON.stringify(messages, null, 2)); // Log para depuração

        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: messages,
        });

        const responseMessage = completion.data.choices[0].message.content;
        res.json({ response: responseMessage });
    } catch (error) {
        console.error("Error in OpenAI API:", error.response ? error.response.data : error.message);
        res.status(500).json({ response: "Error processing the message." });
    }
});

// Rota para teste
app.get('/', (req, res) => {
    res.send("Server is running successfully!");
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
