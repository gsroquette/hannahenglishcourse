// atividadesPorTrecho.js

function getActivitiesByTrecho(trecho, level, unit) {
    switch (trecho) {
        case "trecho1":
            return [
                { id: 1, name: "StoryCards", path: `/Atividades/StoryCards/index.html?level=${level}&unit=${unit}&fase=1`, img: "../../imagens/botoes/storycards_button.png", unlocked: false },
                { id: 2, name: "Flashcards", path: `/Atividades/Flashcards/index.html?level=${level}&unit=${unit}&fase=2`, img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
                { id: 3, name: "Flashcards2", path: `/Atividades/Flashcards2/index.html?level=${level}&unit=${unit}&fase=3`, img: "../../imagens/botoes/flashcards_button.png", unlocked: false },   
                { id: 4, name: "Fill in the Blanks", path: `/Atividades/Fill%20in%20the%20Blanks/index.html?level=${level}&unit=${unit}&fase=4`, img: "../../imagens/botoes/fillintheblanks_button.png", unlocked: false },
            ];
        case "trecho2":
            return [
                { id: 5, name: "QUIZ_IMAGE", path: `/Atividades/QUIZ_IMAGE/index.html?level=${level}&unit=${unit}&fase=5`, img: "../../imagens/botoes/quiz_button.png", unlocked: false },
                { id: 6, name: "MemoryGame", path: `/Atividades/MemoryGame/index.html?level=${level}&unit=${unit}&fase=6`, img: "../../imagens/botoes/memorygame_button.png", unlocked: false },
                { id: 7, name: "WordSearchFacil", path: `/Atividades/WordSearchHorizontal/index.html?level=${level}&unit=${unit}&fase=7`, img: "../../imagens/botoes/wordsearch_button.png", unlocked: false },
                { id: 8, name: "MemoryGame2", path: `/Atividades/MemoryGame2/index.html?level=${level}&unit=${unit}&fase=8`, img: "../../imagens/botoes/memorygame_button.png", unlocked: false },
                { id: 9, name: "WordSearchFacil2", path: `/Atividades/WordSearchHorizontal2/index.html?level=${level}&unit=${unit}&fase=9`, img: "../../imagens/botoes/wordsearch_button.png", unlocked: false },
            ];
        case "trecho3":
            return [
                { id: 10, name: "Hannah Video", path: `/Atividades/HannahVideo/index.html?level=${level}&unit=${unit}&fase=10`, img: "../../imagens/botoes/video_button.png", unlocked: false },
                { id: 11, name: "Missing Word", path: `/Atividades/Missing Word/index.html?level=${level}&unit=${unit}&fase=11`, img: "../../imagens/botoes/missing_word_button.png", unlocked: false },
                { id: 12, name: "Missing Word2", path: `/Atividades/Missing Word2/index.html?level=${level}&unit=${unit}&fase=12`, img: "../../imagens/botoes/missing_word_button.png", unlocked: false },   
                { id: 13, name: "Mixed Letters starter", path: `/Atividades/Mixed Letters starter/index.html?level=${level}&unit=${unit}&fase=13`, img: "../../imagens/botoes/mixed_letters_students.png", unlocked: false },
                { id: 14, name: "Mixed Letters starter2", path: `/Atividades/Mixed Letters starter2/index.html?level=${level}&unit=${unit}&fase=14`, img: "../../imagens/botoes/mixed_letters_students.png", unlocked: false },
            ];
        case "trecho4":
            return [
                { id: 15, name: "GrammarStarter", path: `/Atividades/GrammarStarter/index.html?level=${level}&unit=${unit}&fase=15`, img: "../../imagens/botoes/grammar_button.png", unlocked: false },
                { id: 16, name: "Exerciciosdegramatica", path: `/Atividades/Exerciciosdegramatica/index.html?level=${level}&unit=${unit}&fase=16`, img: "../../imagens/botoes/exercises_button.png", unlocked: false },
                { id: 17, name: "Speak", path: `/Atividades/Speak/index.html?level=${level}&unit=${unit}&fase=17`, img: "../../imagens/botoes/speak_button.png", unlocked: false },
                { id: 18, name: "Speak2", path: `/Atividades/Speak2/index.html?level=${level}&unit=${unit}&fase=18`, img: "../../imagens/botoes/speak_button.png", unlocked: false },
            ];
        case "trecho5":
            return [
                { id: 19, name: "GrammarStarterDialogo", path: `/Atividades/GrammarStarterDialogo/index.html?level=${level}&unit=${unit}&fase=19`, img: "../../imagens/botoes/conversation_button.png", unlocked: false },
                { id: 20, name: "QUIZ_IMAGE2", path: `/Atividades/QUIZ_IMAGE2/index.html?level=${level}&unit=${unit}&fase=20`, img: "../../imagens/botoes/quiz_button.png", unlocked: false },
                { id: 21, name: "Diálogo", path: `/Atividades/Dialogo/index.html?level=${level}&unit=${unit}&fase=21`, img: "../../imagens/botoes/dialogo_button.png", unlocked: false },
            ];
        case "trecho6":
            return [
                { id: 22, name: "MatchingGame", path: `/Atividades/MatchingGame/index.html?level=${level}&unit=${unit}&fase=22`, img: "../../imagens/botoes/matching_game_button.png", unlocked: false },
            ];
        case "trecho7":
            return [
                { id: 23, name: "TestQuizLeVeAB", path: `/Atividades/TestQuizLeVeAB/index.html?level=${level}&unit=${unit}&fase=23`, img: "../../imagens/test.png", unlocked: false },
                { id: 24, name: "TestwordB2CFacil", path: `/Atividades/TestwordB2CFacil/index.html?level=${level}&unit=${unit}&fase=24`, img: "../../imagens/test.png", unlocked: false },
                { id: 25, name: "Testword2B2CFacil", path: `/Atividades/Testword2B2CFacil/index.html?level=${level}&unit=${unit}&fase=25`, img: "../../imagens/test.png", unlocked: false },
            ];
        default:
            return []; // ou um fallback
    }
}
