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
    const svgContainer = document.getElementById('linesSvg');
    let currentPage = 0;
    const phasesPerPage = 6;

    function createPhases(page) {
        const titleContainer = document.querySelector('.title-container');
        
        mapContainer.innerHTML = ''; // Limpa o mapa
        mapContainer.appendChild(titleContainer); // Reanexa a imagem do título

        svgContainer.innerHTML = ''; // Limpa as linhas

        const start = page * phasesPerPage;
        const end = Math.min(start + phasesPerPage, activities.length);

        activities.slice(start, end).forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');

            const baseTopPosition = 200;
            let topPosition, horizontalPosition;

            // Definindo a posição vertical
            const randomVerticalGap = Math.random() * (30 - 20) + 20;
            topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;

            // Alterna entre esquerda e direita
            const positionLeft = index % 2 === 0;
            horizontalPosition = positionLeft
                ? Math.random() * (20 - 5) + 5
                : Math.random() * (95 - 80) + 80;

            phaseDiv.style.top = `${topPosition}px`;
            phaseDiv.style.left = `${horizontalPosition}%`;

            const phaseImage = document.createElement('img');
            phaseImage.src = activity.img;
            phaseImage.alt = activity.name;
            phaseImage.classList.add('phase-img');
            phaseDiv.appendChild(phaseImage);

            mapContainer.appendChild(phaseDiv);
        });

        createNavigationButtons(page);
        drawLines(); // Redesenha as linhas entre as fases da página
    }

    function createNavigationButtons(page) {
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('button-container');

        buttonContainer.style.position = 'absolute';
        buttonContainer.style.bottom = '20px';
        buttonContainer.style.left = '50%';
        buttonContainer.style.transform = 'translateX(-50%)';

        if (page > 0) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous';
            prevButton.classList.add('nav-button');
            prevButton.addEventListener('click', () => loadPage(page - 1));
            buttonContainer.appendChild(prevButton);
        }

        if ((page + 1) * phasesPerPage < activities.length) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next';
            nextButton.classList.add('nav-button');
            nextButton.addEventListener('click', () => loadPage(page + 1));
            buttonContainer.appendChild(nextButton);
        }

        mapContainer.appendChild(buttonContainer);
    }

    function loadPage(page) {
        currentPage = page;
        createPhases(page);
    }

    function drawLines() {
        svgContainer.innerHTML = ''; // Limpa as linhas anteriores

        const phases = document.querySelectorAll('.phase');
        const mapRect = mapContainer.getBoundingClientRect(); // Coordenadas do contêiner do mapa

        for (let i = 0; i < phases.length - 1; i++) {
            const phase1 = phases[i];
            const phase2 = phases[i + 1];

            if (phase1 && phase2) {
                const coords1 = phase1.getBoundingClientRect();
                const coords2 = phase2.getBoundingClientRect();

                // Verificando as coordenadas no console
                console.log(`Phase ${i} - coords1:`, coords1);
                console.log(`Phase ${i+1} - coords2:`, coords2);

                // Ajusta as coordenadas em relação ao contêiner do mapa
                const startX = coords1.left + coords1.width / 2 - mapRect.left;
                const startY = coords1.top + coords1.height / 2 - mapRect.top;
                const endX = coords2.left + coords2.width / 2 - mapRect.left;
                const endY = coords2.top + coords2.height / 2 - mapRect.top;

                const controlPointX1 = startX + (endX - startX) * 0.33;
                const controlPointY1 = startY + (endY - startY) * 0.33 + 150;
                const controlPointX2 = startX + (endX - startX) * 0.66;
                const controlPointY2 = endY - 150;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const d = `M ${startX} ${startY} 
                           C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, 
                           ${endX} ${endY}`;
                path.setAttribute('d', d);
                path.setAttribute('class', `path path-blue`);
                path.style.stroke = "blue";
                path.style.strokeWidth = "4";
                path.style.fill = "none";
                svgContainer.appendChild(path);
            }
        }
    }

    loadPage(currentPage);  // Carrega a primeira página
});

    