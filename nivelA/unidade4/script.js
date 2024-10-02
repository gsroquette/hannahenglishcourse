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
        { id: 23, name: "MatchingGame", path: "../unidade2/MatchingGame/index.html", img: "../../imagens/botoes/matching_game_button.png" }
    ];

   
    const mapContainer = document.getElementById('mapContainer');
    let currentPhase = 0;
    let player;
    let positionLeft = true;  // Inicia pela esquerda

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png';
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    // Exibir apenas 6 fases
    activities.slice(0, 6).forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');

        const baseTopPosition = 200;
        let topPosition, horizontalPosition;

        // Definindo a posição vertical
        const randomVerticalGap = Math.random() * (30 - 20) + 20;
        topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;

        // Alterna entre esquerda e direita
        if (positionLeft) {
            horizontalPosition = Math.random() * (20 - 5) + 5; // Posição à esquerda
        } else {
            horizontalPosition = Math.random() * (95 - 80) + 80; // Posição à direita
        }

        positionLeft = !positionLeft; // Alterna a posição para a próxima fase

        // Define as posições calculadas
        phaseDiv.style.top = `${topPosition}px`;
        phaseDiv.style.left = `${horizontalPosition}%`;

        const phaseImage = document.createElement('img');
        phaseImage.src = activity.img;
        phaseImage.alt = activity.name;
        phaseImage.classList.add('phase-img');
        phaseDiv.appendChild(phaseImage);

        mapContainer.appendChild(phaseDiv);

        if (index === currentPhase) {
            phaseDiv.classList.add('active');
        } else if (index > currentPhase) {
            phaseDiv.classList.add('locked');

            const lockIcon = document.createElement('img');
            lockIcon.src = '../../imagens/lock_icon_resized.png';
            lockIcon.classList.add('lock-icon');
            mapContainer.appendChild(lockIcon);

            lockIcon.style.top = `${topPosition}px`;
            lockIcon.style.left = `${horizontalPosition}%`;
        }

        phaseDiv.addEventListener('click', () => {
            if (!phaseDiv.classList.contains('locked')) {
                moveToPhase(index, activity.path);
            }
        });
    });

    function moveToPhase(index, path = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();

        // Atualiza as fases anteriores
        document.querySelectorAll('.phase').forEach(phase => { phase.classList.remove('active'); });
        phase.classList.add('active');

        // Movimenta o bonequinho para a fase selecionada
        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        player.classList.add('moving');

        // Verifica se a fase está visível e centraliza se necessário
        const phaseInView = phase.getBoundingClientRect().top >= 0 && phase.getBoundingClientRect().bottom <= window.innerHeight;
        if (!phaseInView) {
            window.scrollTo({
                top: coords.top + window.scrollY - window.innerHeight / 2,
                behavior: 'smooth'
            });
        }

        // Se houver um caminho associado à fase, abre a atividade
        if (path) {
            setTimeout(() => {
                window.location.href = path;
            }, 600);
        }
    }

    createPlayer();
});
