document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../Unit4/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png", unlocked: false },
        { id: 2, name: "Flashcards", path: "../Unit4/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 3, name: "Flashcards2", path: "../Unit4/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 4, name: "Flashcards3", path: "../Unit4/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 5, name: "QUIZ", path: "../Unit4/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png", unlocked: false },
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;
    let player;
    let positionLeft = true;

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; 
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    function loadUserProgress() {
        const urlPathParts = window.location.pathname.split('/');
        const level = urlPathParts[urlPathParts.length - 3]; // Extrai o nível da URL (ex: 'Level1')
        const unit = urlPathParts[urlPathParts.length - 2];  // Extrai a unidade da URL (ex: 'Unit4')

        const userId = "SUNqNvm"; // ID do usuário fixo para teste; adaptar conforme necessário para usuários dinâmicos

        // Construir o caminho correto no Firebase
        const progressRef = firebase.database().ref(`/usuarios/${userId}/progresso/${level}/${unit}`);
        
        progressRef.once('value')
            .then((snapshot) => {
                const progress = snapshot.val();
                if (progress) {
                    activities.forEach((activity, index) => {
                        if (progress[`fase${index + 1}`] === true) {
                            activity.unlocked = true;
                            currentPhase = index; // Atualiza a última fase liberada
                        }
                    });
                } else {
                    console.error("Nenhum progresso encontrado para este nível e unidade.");
                }
                initializeMap();
                createPlayer();
            })
            .catch((error) => {
                console.error("Erro ao carregar o progresso do usuário:", error);
                initializeMap(); // Ainda inicializa o mapa, mesmo se houver erro
                createPlayer();
            });
    }

    function initializeMap() {
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

            if (activity.unlocked) {
                phaseDiv.classList.add('active');
            } else {
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
                    moveToPhase(index, activity.path, index);
                }
            });
        });
        drawLines();
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

        if (clickedIndex !== null && clickedIndex < activities.length - 1) {
            setTimeout(() => {
                unlockNextPhase(clickedIndex, path);
                updateLineColor(clickedIndex);
            }, 600);
        } else if (path) {
            // Abrir a fase se não houver próxima fase para desbloquear
            setTimeout(() => {
                window.location.href = path;
            }, 600);
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

    loadUserProgress(); // Carrega o progresso do usuário ao iniciar a página
});
