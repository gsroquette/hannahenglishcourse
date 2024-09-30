document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "Flashcards2", path: "../unidade2/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 4, name: "Flashcards3", path: "../unidade2/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 5, name: "MemoryGame", path: "../unidade2/MemoryGame/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 6, name: "MemoryGame2", path: "../unidade2/MemoryGame2/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 7, name: "MemoryGame3", path: "../unidade2/MemoryGame3/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 8, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" },
        { id: 9, name: "WordSearch", path: "../unidade2/WordSearch/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 10, name: "WordSearch2", path: "../unidade2/WordSearch2/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 11, name: "WordSearch3", path: "../unidade2/WordSearch3/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 12, name: "Grammar", path: "../unidade2/Grammar/index.html", img: "../../imagens/botoes/grammar_button.png" },
        { id: 13, name: "Fill in the Blanks", path: "../unidade2/Fill in the Blanks/index.html", img: "../../imagens/botoes/fillintheblanks_button.png" },
        { id: 14, name: "Mixed Letters FIXO", path: "../unidade2/Mixed Letters FIXO/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 15, name: "Mixed Letters FIXO2", path: "../unidade2/Mixed Letters FIXO2/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 16, name: "Mixed Letters FIXO3", path: "../unidade2/Mixed Letters FIXO3/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 17, name: "Missing Word", path: "../unidade2/Missing Word/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 18, name: "Missing Word2", path: "../unidade2/Missing Word2/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 19, name: "Missing Word3", path: "../unidade2/Missing Word3/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 20, name: "Speak", path: "../unidade2/Speak/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 21, name: "Speak2", path: "../unidade2/Speak2/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 22, name: "Speak3", path: "../unidade2/Speak3/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 23, name: "MatchingGame", path: "../unidade2/MatchingGame/index.html", img: "../../imagens/botoes/matching_game_button.png" },
        { id: 24, name: "Fine Motor Skills", path: "../unidade2/Fine Motor Skills/index.html", img: "../../imagens/botoes/Fine_Motor_Skills_Button.png" },
        { id: 25, name: "Missing Letter", path: "../unidade2/Missing Letter/index.html", img: "../../imagens/botoes/missing_letter_button.png" },
        { id: 26, name: "Mixed Letters", path: "../unidade2/Mixed Letters/index.html", img: "../../imagens/botoes/mixed_letters_button.png" }
    ];

    const mapContainer = document.getElementById('mapContainer');
    let currentPhase = 0;
    let player; // Referência ao bonequinho

    // Função para adicionar o bonequinho
    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; // Caminho da imagem do bonequinho
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase); // Posicionar o bonequinho na fase inicial
    }

    // Adicionar fases no mapa
    activities.forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');
        phaseDiv.style.top = `${10 + index * 15}%`; // Posição vertical dinâmica
        phaseDiv.style.left = `${10 + index * 10}%`; // Posição horizontal dinâmica

        // Adicionar imagem da fase
        const phaseImage = document.createElement('img');
        phaseImage.src = activity.img; // Carregar a imagem correspondente
        phaseImage.alt = activity.name;
        phaseDiv.appendChild(phaseImage);

        // Definir fases bloqueadas/desbloqueadas
        if (index === currentPhase) {
            phaseDiv.classList.add('active'); // A fase ativa
        } else if (index > currentPhase) {
            phaseDiv.classList.add('locked'); // Fases bloqueadas
        }

        phaseDiv.addEventListener('click', () => {
            if (!phaseDiv.classList.contains('locked')) {
                window.location.href = activity.path; // Abrir o HTML correspondente
            }
        });

        mapContainer.appendChild(phaseDiv);
    });

    // Função para mover o bonequinho
    function moveToPhase(index) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        
        // Mover o bonequinho para a fase com animação
        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        player.classList.add('moving');
    }

    // Adicionar o bonequinho no mapa
    createPlayer();
});
