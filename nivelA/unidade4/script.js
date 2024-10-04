document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png", unlocked: true, completed: false },
        { id: 2, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false, completed: false },
        { id: 3, name: "Flashcards2", path: "../unidade2/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false, completed: false },
        { id: 4, name: "Flashcards3", path: "../unidade2/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false, completed: false },
        { id: 8, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png", unlocked: false, completed: false },
    ];

    const mapContainer = document.getElementById('mapContainer');
    let currentPhase = 0;
    let player;

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; 
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    function moveToPhase(index, path = null, clickedIndex = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        document.querySelectorAll('.phase').forEach(phase => { phase.classList.remove('active'); });
        phase.classList.add('active');

        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        player.classList.add('moving');

        const phaseInView = phase.getBoundingClientRect().top >= 0 && phase.getBoundingClientRect().bottom <= window.innerHeight;
        if (!phaseInView) {
            window.scrollTo({
                top: coords.top + window.scrollY - window.innerHeight / 2,
                behavior: 'smooth'
            });
        }

        if (path) {
            // Abrir a fase atual e esperar a conclusão
            setTimeout(() => {
                window.location.href = path;
            }, 600);
        }
    }

    function unlockNextPhase() {
        if (currentPhase < activities.length - 1) {
            const nextActivity = activities[currentPhase + 1];
            nextActivity.unlocked = true;

            const nextPhase = document.querySelectorAll('.phase')[currentPhase + 1];
            nextPhase.classList.remove('locked');
            nextPhase.classList.add('unlocked');
        }
    }

    function checkCompletion() {
        // Verificar se a fase foi completada quando o jogador retorna ao mapa
        const savedPhase = parseInt(localStorage.getItem('completedPhase')) || 0;
        if (savedPhase > currentPhase) {
            currentPhase = savedPhase;
            unlockNextPhase();
        }
    }

    activities.forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');
        
        const phaseImage = document.createElement('img');
        phaseImage.src = activity.img;
        phaseImage.alt = activity.name;
        phaseImage.classList.add('phase-img');
        phaseDiv.appendChild(phaseImage);

        if (!activity.unlocked) {
            phaseDiv.classList.add('locked');
        }

        mapContainer.appendChild(phaseDiv);

        phaseDiv.addEventListener('click', () => {
            if (!phaseDiv.classList.contains('locked')) {
                moveToPhase(index, activity.path, index);
            }
        });
    });

    createPlayer();
    checkCompletion();
    
    window.addEventListener('beforeunload', function() {
        // Salvar o progresso quando o jogador sai da fase atual
        localStorage.setItem('completedPhase', currentPhase);
    });
});
