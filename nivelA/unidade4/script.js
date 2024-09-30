document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "MemoryGame", path: "../unidade2/MemoryGame/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 4, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" },
        { id: 5, name: "WordSearch", path: "../unidade2/WordSearch/index.html", img: "../../imagens/botoes/wordsearch_button.png" }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;
    let player;

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; // Caminho da imagem do bonequinho
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase); // Posicionar o bonequinho na fase inicial
    }

    activities.forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');

        // Alternar as posições dos círculos para criar o efeito zigzag
        if (index % 2 === 0) {
            phaseDiv.style.top = `${10 + index * 25}%`;  // Fases pares mais à esquerda
            phaseDiv.style.left = '20%';
        } else {
            phaseDiv.style.top = `${10 + index * 25}%`;  // Fases ímpares mais à direita
            phaseDiv.style.left = '70%';
        }

        // Adicionar imagem da fase
        const phaseImage = document.createElement('img');
        phaseImage.src = activity.img;
        phaseImage.alt = activity.name;
        phaseImage.classList.add('phase-img');
        phaseDiv.appendChild(phaseImage);

        if (index === currentPhase) {
            phaseDiv.classList.add('active');
        } else if (index > currentPhase) {
            phaseDiv.classList.add('locked');
        }

        phaseDiv.addEventListener('click', () => {
            if (!phaseDiv.classList.contains('locked')) {
                moveToPhase(index, activity.path, index); // Agora passa também o índice para liberar a próxima fase
            }
        });

        mapContainer.appendChild(phaseDiv);
    });

    function moveToPhase(index, path = null, clickedIndex = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        document.querySelectorAll('.phase').forEach(phase => { phase.classList.remove('active'); });
        phase.classList.add('active');

        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        player.classList.add('moving');

        // Scroll automático para fase fora da tela
        const phaseInView = phase.getBoundingClientRect().top >= 0 && phase.getBoundingClientRect().bottom <= window.innerHeight;
        if (!phaseInView) {
