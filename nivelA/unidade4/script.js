document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade4/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../unidade4/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "Flashcards2", path: "../unidade4/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 4, name: "Flashcards3", path: "../unidade4/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 5, name: "MemoryGame", path: "../unidade4/MemoryGame/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 6, name: "MemoryGame2", path: "../unidade4/MemoryGame2/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 7, name: "MemoryGame3", path: "../unidade4/MemoryGame3/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 8, name: "QUIZ", path: "../unidade4/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" },
        { id: 9, name: "WordSearch", path: "../unidade4/WordSearch/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 10, name: "WordSearch2", path: "../unidade4/WordSearch2/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 11, name: "WordSearch3", path: "../unidade4/WordSearch3/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 12, name: "Grammar", path: "../unidade4/Grammar/index.html", img: "../../imagens/botoes/grammar_button.png" },
        { id: 13, name: "Fill in the Blanks", path: "../unidade4/Fill in the Blanks/index.html", img: "../../imagens/botoes/fillintheblanks_button.png" },
        { id: 14, name: "Mixed Letters FIXO", path: "../unidade4/Mixed Letters FIXO/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 15, name: "Mixed Letters FIXO2", path: "../unidade4/Mixed Letters FIXO2/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 16, name: "Mixed Letters FIXO3", path: "../unidade4/Mixed Letters FIXO3/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 17, name: "Missing Word", path: "../unidade4/Missing Word/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 18, name: "Missing Word2", path: "../unidade4/Missing Word2/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 19, name: "Missing Word3", path: "../unidade4/Missing Word3/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 20, name: "Speak", path: "../unidade4/Speak/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 21, name: "Speak2", path: "../unidade4/Speak2/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 22, name: "Speak3", path: "../unidade4/Speak3/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 23, name: "MatchingGame", path: "../unidade4/MatchingGame/index.html", img: "../../imagens/botoes/matching_game_button.png" }
    ];


    const mapContainer = document.getElementById('mapContainer');
    let currentPhase = 0;
    let player;

    // Função para criar o bonequinho
    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png';
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    // Criando as fases
    activities.forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');

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
        }

        // Adicionar evento de clique
        phaseDiv.addEventListener('click', () => {
            if (!phaseDiv.classList.contains('locked')) {
                moveToPhase(index, activity.path);
            } else {
                console.log("Fase bloqueada. Complete a fase anterior.");
            }
        });
    });

    // Função para mover o bonequinho
    function moveToPhase(index, path = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = getAbsolutePosition(phase);
        document.querySelectorAll('.phase').forEach(phase => { phase.classList.remove('active'); });
        phase.classList.add('active');

        player.style.top = `${coords.top + coords.height / 2 - player.offsetHeight / 2}px`;
        player.style.left = `${coords.left + coords.width / 2 - player.offsetWidth / 2}px`;

        if (path) {
            setTimeout(() => {
                window.location.href = path;
            }, 600);
        }
    }

    // Função para obter a posição absoluta de um elemento no documento
    function getAbsolutePosition(element) {
        let top = 0;
        let left = 0;
        let width = element.offsetWidth;
        let height = element.offsetHeight;

        // Loop para obter o deslocamento total do elemento em relação ao documento
        while (element) {
            top += element.offsetTop - element.scrollTop + element.clientTop;
            left += element.offsetLeft - element.scrollLeft + element.clientLeft;
            element = element.offsetParent;
        }

        return { top, left, width, height };
    }

    // Função para redimensionar o SVG com base no conteúdo
    function resizeSVG() {
        const svg = document.getElementById('linesSvg');
        const mapContainerRect = mapContainer.getBoundingClientRect();
        svg.style.width = `${mapContainerRect.width}px`;  // Ajustar a largura
        svg.style.height = `${mapContainerRect.height}px`;  // Ajustar a altura
    }

    // Função para desenhar linhas sinuosas entre as fases
    function drawCurvedLines() {
        const phases = document.querySelectorAll('.phase');
        const svg = document.getElementById('linesSvg');
        svg.innerHTML = ''; // Limpa o SVG antes de desenhar as linhas

        phases.forEach((phase, index) => {
            if (index < phases.length - 1) {
                const startCoords = getAbsolutePosition(phase);
                const endCoords = getAbsolutePosition(phases[index + 1]);

                const startX = startCoords.left + startCoords.width / 2;
                const startY = startCoords.top + startCoords.height / 2;
                const endX = endCoords.left + endCoords.width / 2;
                const endY = endCoords.top + endCoords.height / 2;

                // Ajustando os pontos de controle para garantir uma curva mais precisa
                const controlX1 = (startX + endX) / 2 - 100; // Mais afastado para sinuosidade
                const controlY1 = startY + 50; // Ajuste para suavizar a curva
                const controlX2 = (startX + endX) / 2 + 100; // Mais afastado para sinuosidade
                const controlY2 = endY - 50; // Ajuste para suavizar a curva

                // Desenhando uma linha curva (sinuosa)
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const d = `M ${startX},${startY} C ${controlX1},${controlY1}, ${controlX2},${controlY2}, ${endX},${endY}`;
                path.setAttribute('d', d);
                path.setAttribute('stroke', 'black'); // Cor da linha
                path.setAttribute('stroke-width', '4'); // Largura da linha mais grossa
                path.setAttribute('stroke-dasharray', '8,8'); // Efeito pontilhado
                path.setAttribute('fill', 'none'); // Não preencher a curva

                svg.appendChild(path);
            }
        });
    }

    createPlayer(); // Cria o bonequinho
    resizeSVG(); // Redimensiona o SVG para cobrir o conteúdo
    drawCurvedLines(); // Desenha as linhas sinuosas entre as fases

    // Recalcular e redesenhar as linhas ao redimensionar a janela ou fazer scroll
    window.addEventListener('resize', () => {
        resizeSVG(); // Redimensiona o SVG quando a janela é redimensionada
        drawCurvedLines(); // Redesenha as linhas
    });

    window.addEventListener('scroll', drawCurvedLines); // Redesenha as linhas ao fazer scroll
});
