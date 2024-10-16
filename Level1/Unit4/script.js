document.addEventListener('DOMContentLoaded', function() {
    const database = firebase.database();
    const auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (user) {
            const userId = user.uid; // Obter o ID do usuário autenticado
            console.log(`Usuário autenticado: ${userId}`);
            unlockPhasesFromDatabase(userId); // Passar o userId para a função
        } else {
            console.error("Usuário não autenticado!");
            // Redirecionar para a página de login ou exibir uma mensagem de erro, se necessário
        }
    });

    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade4/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png", unlocked: false },
        { id: 2, name: "Flashcards", path: "../unidade4/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 3, name: "Flashcards2", path: "../unidade4/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 4, name: "Flashcards3", path: "../unidade4/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 5, name: "QUIZ", path: "../unidade4/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png", unlocked: false },
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let player;
    let positionLeft = true;

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; 
        player.classList.add('player');
        mapContainer.appendChild(player);
    }

    function unlockPhasesFromDatabase(userId) {
        database.ref(`/usuarios/${userId}/progresso/Level1/Unit1`).once('value')
            .then(snapshot => {
                let lastUnlockedIndex = -1;
                snapshot.forEach((childSnapshot, index) => {
                    if (index < activities.length) { // Verifica se o índice está no intervalo do array
                        const isUnlocked = childSnapshot.val();
                        if (isUnlocked) {
                            activities[index].unlocked = true;
                            lastUnlockedIndex = index;
                        }
                    } else {
                        console.error(`Índice ${index} fora do alcance de activities.`);
                    }
                });

                renderPhases(lastUnlockedIndex);
            })
            .catch(error => {
                console.error("Erro ao carregar dados do Firebase:", error);
            });
    }

    function renderPhases(lastUnlockedIndex) {
        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');

            const baseTopPosition = 200;
            const randomVerticalGap = Math.random() * (30 - 20) + 20;
            let topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;
            let horizontalPosition = positionLeft ? Math.random() * (20 - 5) + 5 : Math.random() * (95 - 80) + 80;
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
                if (index === lastUnlockedIndex) {
                    animateUnlock(phaseDiv);
                }
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

        drawLines();
        createPlayer();
    }

    function animateUnlock(phaseDiv) {
        const unlockGif = document.createElement('img');
        unlockGif.src = '../../imagens/cadeado.gif';
        unlockGif.classList.add('unlock-gif');
        phaseDiv.appendChild(unlockGif);

        unlockGif.style.position = 'absolute';
        unlockGif.style.top = '50%';
        unlockGif.style.left = '50%';
        unlockGif.style.transform = 'translate(-50%, -50%)';

        setTimeout(() => {
            unlockGif.remove();
        }, 3000);
    }

    function moveToPhase(index, path) {
        const phase = document.querySelectorAll('.phase')[index];
        if (!phase) return; // Verificação para garantir que 'phase' existe

        const coords = phase.getBoundingClientRect();
        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        if (path) {
            setTimeout(() => {
                window.location.href = path;
            }, 600);
        }
    }

    function drawLines() {
        svgContainer.innerHTML = '';
        const phases = document.querySelectorAll('.phase');
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = phases[i];
            const phase2 = phases[i + 1];
            if (!phase1 || !phase2) continue; // Verifica se ambos elementos existem

            const coords1 = phase1.getBoundingClientRect();
            const coords2 = phase2.getBoundingClientRect();
            const controlPointX1 = coords1.left + (coords2.left - coords1.left) * 0.33;
            const controlPointY1 = coords1.top + (coords2.top - coords1.top) * 0.33 + 150;
            const controlPointX2 = coords1.left + (coords2.left - coords1.left) * 0.66;
            const controlPointY2 = coords2.top - 150;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${coords1.left + coords1.width / 2} ${coords1.top + coords1.height / 2} C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, ${coords2.left + coords2.width / 2} ${coords2.top + coords2.height / 2}`;
            path.setAttribute('d', d);
            path.setAttribute('class', `path path-blue`);
            svgContainer.appendChild(path);
        }
    }

    window.addEventListener('resize', drawLines);
});
