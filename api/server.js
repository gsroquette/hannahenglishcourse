const textToSpeech = require('@google-cloud/text-to-speech'); // Importa a biblioteca do Google
const fs = require('fs'); // Biblioteca para manipular arquivos
const util = require('util'); // Biblioteca de utilitários

// Inicializa o cliente do Google Cloud Text-to-Speech
const client = new textToSpeech.TextToSpeechClient({
    keyFilename: 'google-cloud-key.json' // Nome do seu arquivo JSON
});

// Função que recebe um texto e retorna o áudio convertido
async function generateSpeech(text) {
    const request = {
        input: { text: text }, // O que será lido
        voice: { languageCode: 'en-US', ssmlGender: 'en-US-Standard-D' }, // Configuração da voz (idioma e gênero)
        audioConfig: { audioEncoding: 'MP3' }, // Tipo de áudio que será gerado
    };

    const [response] = await client.synthesizeSpeech(request); // Chama a API do Google
    return response.audioContent; // Retorna o áudio pronto
}

// Exporta a função para ser usada em outros arquivos
module.exports = { generateSpeech };
