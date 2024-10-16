document.addEventListener('DOMContentLoaded', function() {
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
    let previousPosition = null;
    let positionLeft = true;

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; 
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    function isTooClose(pos1, pos2) {
        const minDistance = 100;
        const dx = pos1.left - pos2.left;
        const dy = pos1.top - pos2.top;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < minDistance;
    }

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

        if (index === currentPhase) {
            phaseDiv.classList.add('active');
        } else if (index > currentPhase) {
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

    function unlockNextPhase(index, path) {
        if (index < activities.length - 1) {
            const nextPhase = document.querySelectorAll('.phase')[index + 1];
            const nextActivity = activities[index + 1];

            if (!nextActivity.unlocked) {
                nextActivity.unlocked = true; // Marcar a fase como desbloqueada

                nextPhase.classList.remove('locked');
                nextPhase.classList.add('unlocked');

                const lockIcon = mapContainer.querySelector('.lock-icon');
                if (lockIcon) {
                    lockIcon.remove();
                }

                const nextPhaseCoords = nextPhase.getBoundingClientRect();

                window.scrollTo({
                    top: nextPhaseCoords.top + window.scrollY - window.innerHeight / 2,
                    left: nextPhaseCoords.left + window.scrollX - window.innerWidth / 2,
                    behavior: 'smooth'
                });

                setTimeout(() => {
                    const zoomFactor = 1.5;
                    const zoomX = nextPhaseCoords.left + window.scrollX + nextPhaseCoords.width / 2;
                    const zoomY = nextPhaseCoords.top + window.scrollY + nextPhaseCoords.height / 2;

                    mapContainer.style.transformOrigin = `${zoomX}px ${zoomY}px`;
                    mapContainer.style.transform = `scale(${zoomFactor})`;
                    mapContainer.style.transition = 'transform 1s ease';

                    setTimeout(() => {
                        const unlockGif = document.createElement('img');
                        unlockGif.src = '../../imagens/cadeado.gif'; 
                        unlockGif.classList.add('unlock-gif');
                        nextPhase.appendChild(unlockGif);

                        unlockGif.style.position = 'absolute';
                        unlockGif.style.top = '50%';
                        unlockGif.style.left = '50%';
                        unlockGif.style.transform = 'translate(-50%, -50%)';

                        setTimeout(() => {
                            unlockGif.remove();
                            mapContainer.style.transform = 'scale(1)';

                            setTimeout(() => {
                                const clickedPhase = document.querySelectorAll('.phase')[index];
                                const clickedCoords = clickedPhase.getBoundingClientRect();
                                window.scrollTo({
                                    top: clickedCoords.top + window.scrollY - window.innerHeight / 2,
                                    behavior: 'smooth'
                                });

                                setTimeout(() => {
                                    window.location.href = path;
                                }, 600);
                            }, 1000);
                        }, 3000);
                    }, 1000);
                }, 600);
            } else {
                // Se a fase já estiver desbloqueada, apenas abrir a fase atual
                window.location.href = path;
            }
        } else {
            // Se não houver próxima fase, apenas abrir a fase atual
            window.location.href = path;
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

    function updateLineColor(index) {
        const paths = document.querySelectorAll('.path');
        if (paths[index]) {
            paths[index].classList.remove('path-blue');
            paths[index].classList.add('path-purple');
        }
    }

    drawLines();
    createPlayer();
    window.addEventListener('resize', drawLines);
});
