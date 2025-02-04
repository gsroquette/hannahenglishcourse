const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');

// Inicializa o cliente Google TTS com a variável de ambiente
const client = new textToSpeech.TextToSpeechClient({
    credentials: JSON.parse(process.env.GOOGLE_TTS_SERVICE_ACCOUNT)
});

async function generateSpeech() {
    const request = {
        input: { text: "Hello! This is a test from Google Text-to-Speech API." },
        voice: { languageCode: 'en-US', name: 'en-US-Standard-D' },
        audioConfig: { audioEncoding: 'MP3' }
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        fs.writeFileSync("output.mp3", response.audioContent, "binary");
        console.log("✅ Áudio gerado com sucesso! Verifique o arquivo output.mp3");
    } catch (error) {
        console.error("❌ Erro ao gerar TTS:", error);
    }
}

generateSpeech();

