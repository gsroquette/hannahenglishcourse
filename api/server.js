const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDGgo2H_hDKXF88xN7XnLFNUj8ikMY7Xdc",
    authDomain: "hannahenglishcourse.firebaseapp.com",
    databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hannahenglishcourse",
    storageBucket: "hannahenglishcourse.appspot.com",
    messagingSenderId: "449818788486",
    appId: "1:449818788486:web:8a49d3f68591e6fb3f0707"
};
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// Rota inicial
app.get('/api/start', async (req, res) => {
    try {
        const { uid, level } = req.query;

        if (!uid || !level) {
            return res.status(400).json({ response: "UID and level are required in the URL." });
        }

        const userRef = ref(database, `/usuarios/${uid}`);
        const snapshot = await get(userRef);

        if (!snapshot.exists()) {
            return res.status(404).json({ response: "User not found in Firebase." });
        }

        const userData = snapshot.val();
        const name = userData.nome || "Student";

        res.json({
            response: `Hello ${name}! My name is Lex, your robot friend. Your level is ${level}. Shall we begin?`
        });
    } catch (error) {
        console.error("Error retrieving user data:", error.message);
        res.status(500).json({ response: "Internal server error." });
    }
});

// Rota de interação com a IA
app.post('/api/chat', (req, res) => {
    const userMessage = req.body.message;
    if (!userMessage) {
        return res.status(400).json({ response: "Message cannot be empty." });
    }

    const responseMessage = `You said: "${userMessage}". Let's continue!`;
    res.json({ response: responseMessage });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
