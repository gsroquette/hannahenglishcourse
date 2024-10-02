document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        // Lista das fases
        { id: 1, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "Flashcards2", path: "../unidade2/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 4, name: "Flashcards3", path: "../unidade2/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 5, name: "MemoryGame", path: "../unidade2/MemoryGame/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 6, name: "MemoryGame2", path: "../unidade2/MemoryGame2/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 7, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" },
        { id: 8, name: "WordSearch", path: "../unidade2/WordSearch/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 9, name: "Grammar", path: "../unidade2/Grammar/index.html", img: "../../imagens/botoes/grammar_button.png" },
        { id: 10, name: "Fill in the Blanks", path: "../unidade2/Fill in the Blanks/index.html", img: "../../imagens/botoes/fillintheblanks_button.png" },
        { id: 11, name: "Mixed Letters FIXO", path: "../unidade2/Mixed Letters FIXO/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 12, name: "Speak", path: "../unidade2/Speak/index.html", img: "../../imagens/botoes/speak_button.png" }
    ];

    let currentPhase = 0;
    let visiblePhaseStart = 0;
    const phasesPerPage = 6; // Quantidade de fases por página

    const mapContainer = document.getElementById('mapContainer');

    function renderPhases() {
        mapContainer.innerHTML = ''; // Limpa as fases existentes

        // Renderizar apenas o grupo atual de 6 fases
        const visiblePhases = activities.slice(visiblePhaseStart, visiblePhaseStart + phasesPerPage);

        visiblePhases.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');

            const phaseImage = document.createElement('img');
            phaseImage.src = activity.img;
            phaseImage.alt = activity.name;
            phaseImage.classList.add('phase-img');
            phaseDiv.appendChild(phaseImage);

            // Definir comportamento do clique para abrir a fase
            phaseDiv.addEventListener('click', () => {
                if (!phaseDiv.classList.contains('locked')) {
                    window.location.href = activity.path;
                }
            });

            mapContainer.appendChild(phaseDiv);
        });

        createNavigationButtons();
    }

    // Função para criar os botões "Anterior" e "Próximo"
    function createNavigationButtons() {
        if (visiblePhaseStart > 0) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Anterior';
            prevButton.classList.add('nav-button');
            prevButton.addEventListener('click', () => {
                visiblePhaseStart -= phasesPerPage;
                renderPhases();
            });
            mapContainer.appendChild(prevButton);
        }

        if (visiblePhaseStart + phasesPerPage < activities.length) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Próximo';
            nextButton.classList.add('nav-button');
            nextButton.addEventListener('click', () => {
                visiblePhaseStart += phasesPerPage;
                renderPhases();
            });
            mapContainer.appendChild(nextButton);
        }
    }

    // Inicializa a renderização das fases
    renderPhases();
});
