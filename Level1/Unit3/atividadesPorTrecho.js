// atividadesPorTrechoAvancado.js

function getActivitiesByTrecho(trecho, level, unit) {
    switch (trecho) {
        case "trecho1":
            return [
                { id: 1001, name: "StoryCards", path: `/Atividades/StoryCards/index.html?level=${level}&unit=${unit}&fase=1001`, img: "../../imagens/botoes/storycards_button.png", unlocked: false },
                { id: 1002, name: "Flashcards", path: `/Atividades/Flashcards/index.html?level=${level}&unit=${unit}&fase=1002`, img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
                { id: 1003, name: "Flashcards2", path: `/Atividades/Flashcards2/index.html?level=${level}&unit=${unit}&fase=1003`, img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
                { id: 1004, name: "Flashcards3", path: `/Atividades/Flashcards3/index.html?level=${level}&unit=${unit}&fase=1004`, img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
                { id: 1005, name: "QUIZ", path: `/Atividades/QUIZ/index.html?level=${level}&unit=${unit}&fase=1005`, img: "../../imagens/botoes/quiz_button.png", unlocked: false },
                { id: 1006, name: "MemoryGame", path: `/Atividades/MemoryGame/index.html?level=${level}&unit=${unit}&fase=1006`, img: "../../imagens/botoes/memorygame_button.png", unlocked: false },
            ];
        case "trecho2":
            return [
                { id: 1007, name: "Grammar", path: `/Atividades/Grammar/index.html?level=${level}&unit=${unit}&fase=1007`, img: "../../imagens/botoes/grammar_button.png", unlocked: false },
                { id: 1008, name: "Exerciciosdegramatica", path: `/Atividades/Exerciciosdegramatica/index.html?level=${level}&unit=${unit}&fase=1008`, img: "../../imagens/botoes/exercises_button.png", unlocked: false },
                { id: 1009, name: "WordSearch", path: `/Atividades/WordSearch/index.html?level=${level}&unit=${unit}&fase=1009`, img: "../../imagens/botoes/wordsearch_button.png", unlocked: false },
                { id: 1010, name: "MemoryGame2", path: `/Atividades/MemoryGame2/index.html?level=${level}&unit=${unit}&fase=1010`, img: "../../imagens/botoes/memorygame_button.png", unlocked: false },
                { id: 1011, name: "WordSearch2", path: `/Atividades/WordSearch2/index.html?level=${level}&unit=${unit}&fase=1011`, img: "../../imagens/botoes/wordsearch_button.png", unlocked: false },
                { id: 1012, name: "MemoryGame3", path: `/Atividades/MemoryGame3/index.html?level=${level}&unit=${unit}&fase=1012`, img: "../../imagens/botoes/memorygame_button.png", unlocked: false },
            ];
        case "trecho3":
            return [
                { id: 1013, name: "Fill in the Blanks", path: `/Atividades/Fill%20in%20the%20Blanks/index.html?level=${level}&unit=${unit}&fase=1013`, img: "../../imagens/botoes/fillintheblanks_button.png", unlocked: false },
                { id: 1014, name: "Grammar2", path: `/Atividades/Grammar2/index.html?level=${level}&unit=${unit}&fase=1014`, img: "../../imagens/botoes/grammar_button.png", unlocked: false },
                { id: 1015, name: "Exerciciosdegramatica2", path: `/Atividades/Exerciciosdegramatica2/index.html?level=${level}&unit=${unit}&fase=1015`, img: "../../imagens/botoes/exercises_button.png", unlocked: false },
                { id: 1016, name: "WordSearch3", path: `/Atividades/WordSearch3/index.html?level=${level}&unit=${unit}&fase=1016`, img: "../../imagens/botoes/wordsearch_button.png", unlocked: false },
                { id: 1017, name: "Missing Word", path: `/Atividades/Missing Word/index.html?level=${level}&unit=${unit}&fase=1017`, img: "../../imagens/botoes/missing_word_button.png", unlocked: false },
                { id: 1018, name: "Missing Word2", path: `/Atividades/Missing Word2/index.html?level=${level}&unit=${unit}&fase=1018`, img: "../../imagens/botoes/missing_word_button.png", unlocked: false },
            ];
        case "trecho4":
            return [
                { id: 1019, name: "Grammar3", path: `/Atividades/Grammar3/index.html?level=${level}&unit=${unit}&fase=1019`, img: "../../imagens/botoes/grammar_button.png", unlocked: false },
                { id: 1020, name: "Exerciciosdegramatica3", path: `/Atividades/Exerciciosdegramatica3/index.html?level=${level}&unit=${unit}&fase=1020`, img: "../../imagens/botoes/exercises_button.png", unlocked: false },
                { id: 1021, name: "Missing Word3", path: `/Atividades/Missing Word3/index.html?level=${level}&unit=${unit}&fase=1021`, img: "../../imagens/botoes/missing_word_button.png", unlocked: false },
                { id: 1022, name: "Mixed Letters FIXO", path: `/Atividades/Mixed Letters FIXO/index.html?level=${level}&unit=${unit}&fase=1022`, img: "../../imagens/botoes/mixed_letters_students.png", unlocked: false },
                { id: 1023, name: "Mixed Letters FIXO2", path: `/Atividades/Mixed Letters FIXO2/index.html?level=${level}&unit=${unit}&fase=1023`, img: "../../imagens/botoes/mixed_letters_students.png", unlocked: false },
                { id: 1024, name: "Mixed Letters FIXO3", path: `/Atividades/Mixed Letters FIXO3/index.html?level=${level}&unit=${unit}&fase=1024`, img: "../../imagens/botoes/mixed_letters_students.png", unlocked: false },
            ];
        case "trecho5":
            return [
                { id: 1025, name: "GrammarDialogo", path: `/Atividades/GrammarDialogo/index.html?level=${level}&unit=${unit}&fase=1025`, img: "../../imagens/botoes/conversation_button.png", unlocked: false },
                { id: 1026, name: "QUIZ2", path: `/Atividades/QUIZ2/index.html?level=${level}&unit=${unit}&fase=1026`, img: "../../imagens/botoes/quiz_button.png", unlocked: false },
                { id: 1027, name: "Diálogo", path: `/Atividades/Dialogo/index.html?level=${level}&unit=${unit}&fase=1027`, img: "../../imagens/botoes/dialogo_button.png", unlocked: false },
            ];
        case "trecho6":
            return [
                { id: 1028, name: "Hannah Video", path: `/Atividades/HannahVideo/index.html?level=${level}&unit=${unit}&fase=1028`, img: "../../imagens/botoes/video_button.png", unlocked: false },
                { id: 1029, name: "MatchingGame", path: `/Atividades/MatchingGame/index.html?level=${level}&unit=${unit}&fase=1029`, img: "../../imagens/botoes/matching_game_button.png", unlocked: false },
                { id: 1030, name: "LifeLessons", path: `/Atividades/LifeLessons/index.html?level=${level}&unit=${unit}&fase=1030`, img: "../../imagens/botoes/life_lessons_button.png", unlocked: false },
                { id: 1031, name: "Speak", path: `/Atividades/Speak/index.html?level=${level}&unit=${unit}&fase=1031`, img: "../../imagens/botoes/speak_button.png", unlocked: false },
                { id: 1032, name: "Speak2", path: `/Atividades/Speak2/index.html?level=${level}&unit=${unit}&fase=1032`, img: "../../imagens/botoes/speak_button.png", unlocked: false },
                { id: 1033, name: "Speak3", path: `/Atividades/Speak3/index.html?level=${level}&unit=${unit}&fase=1033`, img: "../../imagens/botoes/speak_button.png", unlocked: false },
            ];
        case "trecho7":
            return [
                { id: 1034, name: "TestQuizLidoABC", path: `/Atividades/TestQuizLidoABC/index.html?level=${level}&unit=${unit}&fase=1034`, img: "../../imagens/test.png", unlocked: false },
                { id: 1035, name: "TestwordB2C", path: `/Atividades/TestwordB2C/index.html?level=${level}&unit=${unit}&fase=1035`, img: "../../imagens/test.png", unlocked: false },
                { id: 1036, name: "Testword2B2C", path: `/Atividades/Testword2B2C/index.html?level=${level}&unit=${unit}&fase=1036`, img: "../../imagens/test.png", unlocked: false },
                { id: last, name: "Testword3B2C", path: `/Atividades/Testword3B2C/index.html?level=${level}&unit=${unit}&fase=last`, img: "../../imagens/test.png", unlocked: false },
            ];
        default:
            return [];
    }
}
