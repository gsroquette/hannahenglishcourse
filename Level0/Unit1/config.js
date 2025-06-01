/**
 * Aqui centralizamos todas as listas de fases, agrupadas pelo “tipo de atividade”.
 * Cada chave do objeto deve corresponder ao parâmetro “activity” que é passado na URL.
 */
const fasesConfig = {
  listening: [
    { name: "Listening Practice", path: "ListenAndWrite", img: "listen_button.png" },
    { name: "Dictation",          path: "Dictation",       img: "dictation_button.png" }
  ],
  grammar: [
    { name: "Grammar",               path: "Grammar",               img: "grammar_button.png" },
    { name: "Exercícios de Gramática", path: "Exerciciosdegramatica", img: "exercises_button.png" },
    { name: "Speak",                 path: "Speak",                 img: "speak_button.png" },
    { name: "Speak2",                path: "Speak2",                img: "speak_button.png" }
  ],
  speaking: [
    { name: "Hannah Video",   path: "HannahVideo",        img: "video_button.png" },
    { name: "Missing Word",   path: "Missing Word",       img: "missing_word_button.png" },
    { name: "Missing Word2",  path: "Missing Word2",      img: "missing_word_button.png" },
    { name: "Mixed Letters",  path: "Mixed Letters FIXO", img: "mixed_letters_students.png" },
    { name: "Mixed Letters2", path: "Mixed Letters FIXO2",img: "mixed_letters_students.png" }
  ],
  writing: [
    { name: "QUIZ_IMAGE",     path: "QUIZ_IMAGE",       img: "quiz_button.png" },
    { name: "MemoryGame",     path: "MemoryGame",       img: "memorygame_button.png" },
    { name: "WordSearchFacil",  path: "WordSearchFacil",   img: "wordsearch_button.png" },
    { name: "MemoryGame2",    path: "MemoryGame2",      img: "memorygame_button.png" },
    { name: "WordSearchFacil2", path: "WordSearchFacil2", img: "wordsearch_button.png" }
  ],
  Bible: [
    { name: "Matching Game", path: "MatchingGame",        img: "matching_game_button.png" }
  ],
  apresentacao: [
    /* aqui não havia fases específicas no script6.js: 
       você pode adicionar conforme necessidade */
  ],
  test: [
    { name: "TestQuizLeVeAB",    path: "TestQuizLeVeAB",     img: "test.png" },
    { name: "TestwordB2CFacil",  path: "TestwordB2CFacil",   img: "test.png" },
    { name: "Testword2B2CFacil", path: "Testword2B2CFacil",  img: "test.png" }
  ],
  writing2: [
    { name: "GrammarDialogo",    path: "GrammarDialogo",   img: "conversation_button.png" },
    { name: "QUIZ_IMAGE2",       path: "QUIZ_IMAGE2",      img: "quiz_button.png" },
    { name: "Diálogo",           path: "Dialogo",          img: "dialogo_button.png" }
  ]
};

/** 
 * Algumas observações:
 *  - A chave “writing2” corresponde ao HTML “grammar.html”? 
 *    No seu “script5.js” original, as fases de id 19–21 vinham de “grammar.html”. 
 *    Se preferir nomear essa seção como “grammarDialogo” ou algo similar, basta
 *    ajustar tanto o link no botão de seleção (fases.html?activity=writing2) 
 *    quanto o nome da chave aqui.
 *
 *  - A entrada “apresentacao” foi deixada vazia porque, no script6.js, só havia 
 *    uma fase (id 22) chamada “MatchingGame”. Se for necessário manter exatamente 
 *    “apresentacao.html” mapeie aqui a mesma fase, por exemplo:
 *      apresentacao: [
 *        { name: "MatchingGame", path: "MatchingGame", img: "matching_game_button.png" }
 *      ]
 *    E ajuste o parâmetro de URL ao linkar.
 */
