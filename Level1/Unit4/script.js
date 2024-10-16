document.addEventListener('DOMContentLoaded', async function() {
    // Garante que a rolagem da página esteja no topo
    window.scrollTo(0, 0);

    const activities = [
        { id: 1, name: "StoryCards", path: "../Unit4/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../Unit4/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "Flashcards2", path: "../Unit4/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 4, name: "Flashcards3", path: "../Unit4/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 5, name: "QUIZ", path: "../Unit4/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;
    let player;
    let positionLeft = true;

    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            await fetchUserProgress(user);
            initializePhases();
            createPlayer();
            
            // Adiciona um pequeno atraso para garantir o desenho correto das linhas
            setTimeout(drawLines, 50);
        } else {
            console.error("Usuário não autenticado.");
        }
    });

    async function fetchUserProgress(user) {
        const userId = user.uid;
        const currentUrl = window.location.pathname;
        const levelMatch = currentUrl.match(/Level(\d+)/);
        const unitMatch = currentUrl.match(/Unit(\d+)/);
        
        if (!levelMatch || !unitMatch) return;
        
        const level = `Level${levelMatch[1]}`;
        const unit = `Unit${unitMatch[1]}`;

        try {
            const snapshot = await firebase.database().ref(`usuarios/${userId}/progresso/${level}/${unit}`).get();
            if (snapshot.exists()) {
                const progress = snapshot.val();
                activities.forEach((activity, index) => {
                    if (progress[`fase${index + 1}`]) {
                        activities[index].unlocked = true;
                        currentPhase = index; // Define o boneco na última fase liberada
                    } else {
                        activities[index].unlocked = false;
                    }
                });
            } else {
                console.log("Progresso não encontrado para o usuário.");
            }
        } catch (error) {
            console.error("Erro ao buscar o progresso do usuário:", error);
        }
    }

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; 
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase); // Coloca o boneco na última fase liberada
    }

    async function initializePhases() {
        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');
            
            const baseTopPosition = 200;
            const randomVerticalGap = Math.random() * (30 - 20) + 20;
            const topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;
            const horizontalPosition = positionLeft ? Math.random() * (20 - 5) + 5 : Math.random() * (95 - 80) + 80;
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
                phaseDiv.classList.add('unlocked');
                phaseDiv.classList.remove('locked');
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
                if (activity.unlocked) {
                    moveToPhase(index, activity.path);
                }
            });
        });
    }

    function moveToPhase(index, path = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        document.querySelectorAll('.phase').forEach(phase => { phase.classList.remove('active'); });
        phase.classList.add('active');

        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        
        if (path) {
            setTimeout(() => {
                window.location.href = path;
            }, 600);
        }
    }

    function drawLines() {
        svgContainer.innerHTML = ''; // Limpa o SVG antes de redesenhar as linhas
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = document.querySelectorAll('.phase')[i];
            const phase2 = document.querySelectorAll('.phase')[i + 1];

            if (phase1 && phase2) {
                const phase1Top = parseFloat(phase1.style.top);
                const phase1Left = parseFloat(phase1.style.left) * window.innerWidth / 100;
                const phase2Top = parseFloat(phase2.style.top);
                const phase2Left = parseFloat(phase2.style.left) * window.innerWidth / 100;

                const controlPointX1 = phase1Left + (phase2Left - phase1Left) * 0.33;
                const controlPointY1 = phase1Top + (phase2Top - phase1Top) * 0.33 + 150;
                const controlPointX2 = phase1Left + (phase2Left - phase1Left) * 0.66;
                const controlPointY2 = phase2Top - 150;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const d = `M ${phase1Left} ${phase1Top} 
                           C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, 
                           ${phase2Left} ${phase2Top}`;
                path.setAttribute('d', d);
                path.setAttribute('class', `path path-blue`);
                svgContainer.appendChild(path);
            }
        }
    }

    async function checkForNewUnlock() {
        await fetchUserProgress(firebase.auth().currentUser); // Recarrega o progresso após o retorno

        activities.forEach((activity, index) => {
            const phaseDiv = document.querySelectorAll('.phase')[index];
            if (activity.unlocked && phaseDiv.classList.contains('locked')) {
                phaseDiv.classList.remove('locked');
                phaseDiv.classList.add('unlocked');
                const unlockGif = document.createElement('img');
                unlockGif.src = '../../imagens/cadeado.gif';
                unlockGif.classList.add('unlock-gif');
                phaseDiv.appendChild(unlockGif);
                setTimeout(() => unlockGif.remove(), 3000);
            }
        });
    }

    window.addEventListener('focus', checkForNewUnlock); // Verifica o progresso ao retornar à página

    window.addEventListener('resize', () => {
        window.scrollTo(0, 0);
        drawLines(); // Redesenha as linhas ao redimensionar a tela
    });
});
