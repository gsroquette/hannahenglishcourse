document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 0, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png", unlocked: true },  // Primeira fase
        { id: 1, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 2, name: "Flashcards2", path: "../unidade2/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 3, name: "Flashcards3", path: "../unidade2/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 4, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png", unlocked: false },
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;
    let player;

    // Função para criar o bonequinho (player)
    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; 
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    // Movimenta o bonequinho para a fase selecionada
    function moveToPhase(index) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        document.querySelectorAll('.phase').forEach(phase => { phase.classList.remove('active'); });
        phase.classList.add('active');

        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
    }

    // Verifica o progresso ao retornar ao mapa
    function checkPhaseCompletion() {
        console.log('Verificando se as fases foram completadas...');
        activities.forEach((activity, index) => {
            const phaseCompleted = localStorage.getItem(`phase_${index}_completed`);
            console.log(`Progresso da fase ${index}:`, phaseCompleted);
            if (phaseCompleted) {
                console.log(`Fase ${index} foi completada. Tentando desbloquear a próxima fase.`);
                unlockNextPhase(index);
            }
        });
    }

    // Desbloqueia a próxima fase
    function unlockNextPhase(index) {
        if (index < activities.length - 1) {
            const nextPhase = document.querySelectorAll('.phase')[index + 1];
            const nextActivity = activities[index + 1];

            if (!nextActivity.unlocked) {
                nextActivity.unlocked = true;  // Desbloqueia a próxima fase
                nextPhase.classList.remove('locked');
                nextPhase.classList.add('unlocked');

                // Remove o cadeado
                const lockIcon = mapContainer.querySelector('.lock-icon');
                if (lockIcon) {
                    lockIcon.remove();
                }

                console.log('Próxima fase desbloqueada:', nextActivity.name);
            }
        }
    }

    // Configurações iniciais
    activities.forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');

        const baseTopPosition = 200;
        const randomVerticalGap = Math.random() * (30 - 20) + 20;
        let topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;
        let horizontalPosition = (index % 2 === 0) ? '20%' : '80%';

        phaseDiv.style.top = `${topPosition}px`;
        phaseDiv.style.left = `${horizontalPosition}`;

        const phaseImage = document.createElement('img');
        phaseImage.src = activity.img;
        phaseImage.alt = activity.name;
        phaseImage.classList.add('phase-img');
        phaseDiv.appendChild(phaseImage);

        if (!activity.unlocked) {
            phaseDiv.classList.add('locked');
            const lockIcon = document.createElement('img');
            lockIcon.src = '../../imagens/lock_icon_resized.png';
            lockIcon.classList.add('lock-icon');
            mapContainer.appendChild(lockIcon);
            lockIcon.style.top = `${topPosition}px`;
            lockIcon.style.left = `${horizontalPosition}`;
        }

        phaseDiv.addEventListener('click', () => {
            if (!phaseDiv.classList.contains('locked')) {
                moveToPhase(index);
                setTimeout(() => {
                    window.location.href = activity.path;  // Redireciona para a fase
                }, 600);
            }
        });

        mapContainer.appendChild(phaseDiv);
    });

    createPlayer();  // Cria o bonequinho no mapa
    checkPhaseCompletion();  // Verifica o progresso ao carregar o mapa

    // Desenha as linhas entre as fases
    function drawLines() {
        svgContainer.innerHTML = '';
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = document.querySelectorAll('.phase')[i];
            const phase2 = document.querySelectorAll('.phase')[i + 1];
            const coords1 = phase1.getBoundingClientRect();
            const coords2 = phase2.getBoundingClientRect();

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${coords1.left + coords1.width / 2} ${coords1.top + coords1.height / 2} 
                       C ${coords1.left} ${coords1.top}, ${coords2.left} ${coords2.top}, 
                       ${coords2.left + coords2.width / 2} ${coords2.top + coords2.height / 2}`;
            path.setAttribute('d', d);
            path.setAttribute('class', `path path-blue`);
            svgContainer.appendChild(path);
        }
    }

    drawLines();  // Desenha as linhas iniciais
    window.addEventListener('resize', drawLines);  // Redesenha as linhas ao redimensionar a tela
});
