document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png", unlocked: false, completed: false },
        { id: 2, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false, completed: false },
        { id: 3, name: "Flashcards2", path: "../unidade2/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false, completed: false },
        { id: 4, name: "Flashcards3", path: "../unidade2/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false, completed: false },
        { id: 8, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png", unlocked: false, completed: false },
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;
    let player;
    let previousPosition = null;
    let positionLeft = true;

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; 
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    // Carregar as fases e verificar se alguma fase foi completada
    function loadPhases() {
        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');

            const baseTopPosition = 200;
            let topPosition, horizontalPosition;

            const randomVerticalGap = Math.random() * (30 - 20) + 20;
            topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;

            if (positionLeft) {
                horizontalPosition = Math.random() * (20 - 5) + 5;
            } else {
                horizontalPosition = Math.random() * (95 - 80) + 80;
            }

            positionLeft = !positionLeft;

            phaseDiv.style.top = `${topPosition}px`;
            phaseDiv.style.left = `${horizontalPosition}%`;

            const phaseImage = document.createElement('img');
            phaseImage.src = activity.img;
            phaseImage.alt = activity.name;
            phaseImage.classList.add('phase-img');
            phaseDiv.appendChild(phaseImage);

            mapContainer.appendChild(phaseDiv);

            if (activity.completed) {
                phaseDiv.classList.add('completed');
            }

            if (activity.unlocked || index === currentPhase) {
                phaseDiv.classList.add('active');
            } else if (!activity.unlocked && !activity.completed) {
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
                    enterPhase(index, activity.path);
                }
            });
        });
    }

    // Função para entrar na fase
    function enterPhase(index, path) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();

        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        player.classList.add('moving');

        // Depois de mover o boneco, redirecionar para a fase
        setTimeout(() => {
            window.location.href = path;
        }, 600);
    }

    // Função para liberar a próxima fase quando o jogador retornar ao mapa
    function unlockNextPhase() {
        // A fase atual foi completada, desbloquear a próxima
        if (currentPhase < activities.length - 1 && !activities[currentPhase + 1].unlocked) {
            activities[currentPhase + 1].unlocked = true;
            console.log(`Fase ${currentPhase + 2} desbloqueada!`);
        }
    }

    // Verifica se o jogador está retornando ao mapa
    function checkIfReturning() {
        const urlParams = new URLSearchParams(window.location.search);
        const completedPhase = urlParams.get('completedPhase');

        if (completedPhase) {
            // Marcar a fase como concluída
            activities[completedPhase].completed = true;
            currentPhase = parseInt(completedPhase);

            // Liberar a próxima fase
            unlockNextPhase();

            // Carregar novamente as fases com a nova fase liberada
            loadPhases();
        }
    }

    function drawLines() {
        svgContainer.innerHTML = '';
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = document.querySelectorAll('.phase')[i];
            const phase2 = document.querySelectorAll('.phase')[i + 1];
            const coords1 = phase1.getBoundingClientRect();
            const coords2 = phase2.getBoundingClientRect();

            const controlPointX1 = coords1.left + (coords2.left - coords1.left) * 0.33;
            const controlPointY1 = coords1.top + (coords2.top - coords1.top) * 0.33 + 150;
            const controlPointX2 = coords1.left + (coords2.left - coords1.left) * 0.66;
            const controlPointY2 = coords2.top - 150;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${coords1.left + coords1.width / 2} ${coords1.top + coords1.height / 2} 
                       C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, 
                       ${coords2.left + coords2.width / 2} ${coords2.top + coords2.height / 2}`;
            path.setAttribute('d', d);
            path.setAttribute('class', `path path-blue`);
            svgContainer.appendChild(path);
        }
    }

    drawLines();
    createPlayer();
    checkIfReturning(); // Verifica se o jogador está retornando e desbloqueia a próxima fase
    window.addEventListener('resize', drawLines);
});
