const { generateSpeech } = require('./tts'); // Importa a função do TTS
const fs = require('fs');

async function testarTTS() {
    const text = "Hello, this is a test of Google Text-to-Speech."; // Texto de teste
    const audio = await generateSpeech(text); // Chama a função para gerar o áudio

    fs.writeFileSync('teste.mp3', audio, 'binary'); // Salva o áudio gerado em um arquivo MP3
    console.log("✅ Arquivo de áudio gerado: teste.mp3");
}

testarTTS(); // Chama a função de teste

