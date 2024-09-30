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
        phaseImage.classList.add('phase-img'); // Adicionar classe de estilo
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

                // Desbloquear a próxima fase
                if (index < activities.length - 1) {
                    const nextPhase = document.querySelectorAll('.phase')[index + 1];
                    nextPhase.classList.remove('locked');
                    nextPhase.classList.add('unlocked');
                    setTimeout(() => {
                        nextPhase.classList.remove('unlocked');
                    }, 1000);
                }
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

    // Função para calcular as coordenadas absolutas
    function getCoords(phase) {
        const rect = phase.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    // Desenhar as linhas entre as fases
    function drawLines() {
        svgContainer.innerHTML = ''; // Limpar SVG antes de desenhar
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = document.querySelectorAll('.phase')[i];
            const phase2 = document.querySelectorAll('.phase')[i + 1];

            const coords1 = getCoords(phase1);
            const coords2 = getCoords(phase2);

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${coords1.x} ${coords1.y} Q ${coords1.x + 100} ${coords1.y + 100}, ${coords2.x} ${coords2.y}`;
            path.setAttribute('d', d);
            path.setAttribute('stroke', 'black');
            path.setAttribute('stroke-dasharray', '15,10'); // Traços mais longos para efeito de mapa do tesouro
            path.setAttribute('fill', 'transparent');
            path.setAttribute('stroke-width', '6'); // Espessura da linha
            svgContainer.appendChild(path);
        }
    }

    // Desenhar as linhas após o carregamento
    drawLines();
    createPlayer(); // Adicionar o bonequinho no mapa

    // Recalcular as linhas ao redimensionar a tela
    window.addEventListener('resize', drawLines);
});
