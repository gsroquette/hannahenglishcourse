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
    let previousPosition = null;

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
        let topPosition, randomLeft;

        do {
            const randomVerticalGap = Math.random() * (30 - 20) + 20;
            topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;
            randomLeft = Math.random() * (80 - 20) + 20;
        } while (previousPosition && isTooClose({ top: topPosition, left: randomLeft }, previousPosition));

        previousPosition = { top: topPosition, left: randomLeft };

        phaseDiv.style.top = `${topPosition}px`;
        phaseDiv.style.left = `${randomLeft}%`;

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
            lockIcon.style.left = `${randomLeft}%`;
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
        }
    }

    function unlockNextPhase(index, path) {
        if (index < activities.length - 1) {
            const nextPhase = document.querySelectorAll('.phase')[index + 1];
            nextPhase.classList.remove('locked');
            nextPhase.classList.add('unlocked');

            const lockIcon = mapContainer.querySelector('.lock-icon');
            if (lockIcon) {
                lockIcon.remove();
            }

            // Scroll e zoom para a fase desbloqueada
            const nextPhaseCoords = nextPhase.getBoundingClientRect();
            window.scrollTo({
                top: nextPhaseCoords.top + window.scrollY - window.innerHeight / 2,
                left: nextPhaseCoords.left + window.scrollX - window.innerWidth / 2,
                behavior: 'smooth'
            });

            // Adiciona o zoom temporário
            mapContainer.style.transform = 'scale(1.5)';
            mapContainer.style.transition = 'transform 1s ease';

            // Exibe o gif de cadeado após o scroll
            setTimeout(() => {
                const unlockGif = document.createElement('img');
                unlockGif.src = '../../imagens/cadeado.gif'; // O GIF de cadeado
                unlockGif.classList.add('unlock-gif');
                mapContainer.appendChild(unlockGif);

                unlockGif.style.top = `${nextPhaseCoords.top + window.scrollY + nextPhaseCoords.height / 2}px`;
                unlockGif.style.left = `${nextPhaseCoords.left + window.scrollX + nextPhaseCoords.width / 2}px`;

                // Remove o GIF após 3 segundos e reseta o zoom
                setTimeout(() => {
                    unlockGif.remove();
                    mapContainer.style.transform = 'scale(1)';

                    // Scroll de volta para a fase que será aberta
                    setTimeout(() => {
                        const clickedPhase = document.querySelectorAll('.phase')[index];
                        const clickedCoords = clickedPhase.getBoundingClientRect();
                        window.scrollTo({
                            top: clickedCoords.top + window.scrollY - window.innerHeight / 2,
                            behavior: 'smooth'
                        });

                        // Abre a fase (somente agora)
                        setTimeout(() => {
                            window.location.href = path;
                        }, 600);
                    }, 1000);
                }, 3000);
            }, 1000);
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
