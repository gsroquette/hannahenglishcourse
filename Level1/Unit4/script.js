document.addEventListener('DOMContentLoaded', function() {
    const database = firebase.database();
    const userId = 'SUNqNVmtcrh1YdZgjaRDAu3uAmj2'; // Substitua pelo ID do usuário específico
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade4/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png", unlocked: false },
        { id: 2, name: "Flashcards", path: "../unidade4/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 3, name: "Flashcards2", path: "../unidade4/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 4, name: "Flashcards3", path: "../unidade4/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 5, name: "QUIZ", path: "../unidade4/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png", unlocked: false },
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

    function unlockPhasesFromDatabase() {
        database.ref(`/usuarios/${userId}/progresso/Level1/Unit1`).once('value')
            .then(snapshot => {
                let lastUnlockedIndex = 0;
                snapshot.forEach((childSnapshot, index) => {
                    const phaseKey = childSnapshot.key;
                    const isUnlocked = childSnapshot.val();

                    if (isUnlocked) {
                        activities[index].unlocked = true;
                        lastUnlockedIndex = index;
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
                    moveToPhase(index, activity.path, index);
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

    function moveToPhase(index, path = null, clickedIndex = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        document.querySelectorAll('.phase').forEach(phase => { phase.classList.remove('active'); });
        phase.classList.add('active');

        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        player.classList.add('moving');

        if (path) {
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

    unlockPhasesFromDatabase();
    window.addEventListener('resize', drawLines);
});
