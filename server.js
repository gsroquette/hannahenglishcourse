// Carregar módulos necessários
require('dotenv').config();
const express = require('express');
const app = express();
const port = 3000;

// Middleware para parsing de JSON
app.use(express.json());

// Rota principal para verificar se a API está funcionando
app.get('/', (req, res) => {
    res.send('API está funcionando');
});

// Rota para fornecer a configuração do Firebase
app.get('/firebase-config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
