document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "MemoryGame", path: "../unidade2/MemoryGame/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 4, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" },
        { id: 5, name: "WordSearch", path: "../unidade2/WordSearch/index.html", img: "../../imagens/botoes/wordsearch_button.png" }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const contentWrapper = document.createElement('div'); // Wrapper para fases e scroll
    contentWrapper.classList.add('content');
    mapContainer.appendChild(contentWrapper);

    activities.forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');

        const leftPosition = (index % 2 === 0) ? '20%' : '70%'; // Alterna entre esquerda e direita
        phaseDiv.style.top = `${10 + index * 25}%`; // Espaçamento maior para distribuir fases
        phaseDiv.style.left = leftPosition;

        const phaseImage = document.createElement('img');
        phaseImage.src = activity.img;
        phaseImage.alt = activity.name;
        phaseImage.classList.add('phase-img');
        phaseDiv.appendChild(phaseImage);

        contentWrapper.appendChild(phaseDiv);
    });

    drawLines(); // Função de desenhar as linhas, que já foi implementada

    function drawLines() {
        const svgContainer = document.getElementById('linesSvg');
        svgContainer.innerHTML = ''; // Limpa linhas antigas

        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = document.querySelectorAll('.phase')[i];
            const phase2 = document.querySelectorAll('.phase')[i + 1];
            const coords1 = phase1.getBoundingClientRect();
            const coords2 = phase2.getBoundingClientRect();

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${coords1.left + coords1.width / 2} ${coords1.top + coords1.height / 2}
                       L ${coords2.left + coords2.width / 2} ${coords2.top + coords2.height / 2}`;
            path.setAttribute('d', d);
            path.setAttribute('stroke', 'black');
            path.setAttribute('stroke-dasharray', '15,10');
            path.setAttribute('fill', 'transparent');
            path.setAttribute('stroke-width', '6');
            svgContainer.appendChild(path);
        }
    }
});
