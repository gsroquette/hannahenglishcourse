// Carregar módulos necessários 
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Configurar o Express para servir arquivos estáticos
app.use('/CSS', express.static(path.join(__dirname, 'CSS')));
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));
app.use('/Formulario', express.static(path.join(__dirname, 'Formulario')));
app.use('/Level1', express.static(path.join(__dirname, 'Level1')));
app.use('/Level2', express.static(path.join(__dirname, 'Level2')));
app.use('/Level3', express.static(path.join(__dirname, 'Level3')));
app.use('/Level4', express.static(path.join(__dirname, 'Level4')));

// Rota para servir o index.html na raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint para servir a configuração do Firebase
app.get('/firebase-config', (req, res) => {
    res.json({
        apiKey: process.env.API_KEY,
        authDomain: process.env.AUTH_DOMAIN,
        databaseURL: process.env.DATABASE_URL,
        projectId: process.env.PROJECT_ID,
        storageBucket: process.env.STORAGE_BUCKET,
        messagingSenderId: process.env.MESSAGING_SENDER_ID,
        appId: process.env.APP_ID,
        measurementId: process.env.MEASUREMENT_ID
    });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
