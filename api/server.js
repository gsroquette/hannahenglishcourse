const textToSpeech = require('@google-cloud/text-to-speech'); // Importa a biblioteca do Google 
const fs = require('fs'); // Biblioteca para manipular arquivos
const util = require('util'); // Biblioteca de utilitários

const client = new textToSpeech.TextToSpeechClient({
    credentials: JSON.parse(process.env.GOOGLE_TTS_SERVICE_ACCOUNT || '{}'),
});

// Função que recebe um texto e retorna o áudio convertido
async function generateSpeech(text) {
    console.log("[server.js] generateSpeech chamado com texto:", text);

    const request = {
        input: { text: text }, // O que será lido
        voice: { languageCode: 'en-US', ssmlGender: 'en-US-Standard-D' }, // Configuração da voz (idioma e gênero)
        audioConfig: { audioEncoding: 'MP3' }, // Tipo de áudio que será gerado
    };

    console.log("[server.js] Objeto request para TTS:", request);

    try {
        const [response] = await client.synthesizeSpeech(request); // Chama a API do Google
        console.log("[server.js] Resposta da API TTS recebida com sucesso.");
        return response.audioContent; // Retorna o áudio pronto
    } catch (err) {
        console.error("[server.js] Erro ao gerar fala:", err);
        throw err;
    }
}

// Exporta a função para ser usada em outros arquivos
module.exports = { generateSpeech };
