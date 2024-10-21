document.addEventListener('DOMContentLoaded', function() {
    const database = firebase.database();
    const auth = firebase.auth();

    const activities = [
        { id: 14, name: "WordSearch", path: "../Unit1/WordSearch/index.html?fase=14", img: "../../imagens/botoes/wordsearch_button.png", unlocked: false },
        { id: 15, name: "WordSearch2", path: "../Unit1/WordSearch2/index.html?fase=15", img: "../../imagens/botoes/wordsearch_button.png", unlocked: false },
        { id: 16, name: "WordSearch3", path: "../Unit1/WordSearch3/index.html?fase=16", img: "../../imagens/botoes/wordsearch_button.png", unlocked: false },
        { id: 17, name: "Missing Word", path: "../Unit1/Missing Word/index.html?fase=last", img: "../../imagens/botoes/missing_word_button.png", unlocked: false },
        { id: 18, name: "Mixed Letters FIXO", path: "../Unit1/Mixed Letters FIXO/index.html?fase=18", img: "../../imagens/botoes/mixed_letters_students.png", unlocked: false }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let player;
    let lastUnlockedIndex = -1;

    auth.onAuthStateChanged(user => {
        if (user) {
            const userId = user.uid;
            console.log(`Usuário autenticado: ${userId}`);
            loadUserProgress(userId);
        } else {
            console.error("Usuário não autenticado!");
        }
    });

    function loadUserProgress(userId) {
        const urlPathParts = window.location.pathname.split('/');
        const level = urlPathParts[urlPathParts.length - 3];
        const unit = urlPathParts[urlPathParts.length - 2];

        const progressPath = `/usuarios/${userId}/progresso/${level}/${unit}`;
        const avatarPath = `/usuarios/${userId}/avatar`;

        database.ref(progressPath).once('value')
            .then((snapshot) => {
                const progress = snapshot.val();
                if (progress) {
                    activities.forEach((activity, index) => {
                        // Atualiza a fase com base no ID da atividade
                        if (progress[`fase${activity.id}`] === true) {
                            activity.unlocked = true;
                            lastUnlockedIndex = index;  // Atualiza com o índice da última fase desbloqueada
                        } else {
                            activity.unlocked = false;  // Garante que a fase permaneça bloqueada se não estiver no progresso
                        }
                    });
                } else {
                    console.error("Nenhum progresso encontrado para este nível e unidade.");
                }

                initializeMap();

                database.ref(avatarPath).once('value').then((avatarSnapshot) => {
                    const avatarFileName = avatarSnapshot.val();
                    const avatarImgPath = `../../imagens/${avatarFileName}`;
                    createPlayer(avatarImgPath);
                }).catch(() => {
                    createPlayer(); // Se erro, usar avatar padrão
                });
            })
            .catch((error) => {
                console.error("Erro ao carregar o progresso do usuário:", error);
                initializeMap();
                createPlayer();
            });
    }

    function createPlayer(avatarPath = '../../imagens/bonequinho.png') {
        player = document.createElement('img');
        player.src = avatarPath;
        player.classList.add('player');
        mapContainer.appendChild(player);

        // Determina a fase para posicionar o bonequinho
        const initialPhaseIndex = lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0;
        moveToPhase(initialPhaseIndex);  // Move para a fase uma antes da última desbloqueada, ou a primeira fase
    }

    function initializeMap() {
        // Rola para o topo antes de desenhar as linhas
        window.scrollTo(0, 0);

        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');

            const baseTopPosition = 200;
            let topPosition = baseTopPosition + index * 20 * window.innerHeight / 100;
            let horizontalPosition = index % 2 === 0 ? 10 : 85;

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
                phaseDiv.appendChild(lockIcon);
            }

            phaseDiv.addEventListener('click', () => {
                if (activity.unlocked) {
                    moveToPhase(index, activity.path);
                }
            });
        });

        drawLines();

        // Aplica a animação de desbloqueio na última fase desbloqueada
        if (lastUnlockedIndex >= 0) {
            const lastUnlockedPhase = document.querySelectorAll('.phase')[lastUnlockedIndex];
            animateUnlock(lastUnlockedPhase);

            // Rola para a fase desbloqueada após desenhar as linhas
            scrollToPhase(lastUnlockedIndex);
        }
    }

    function animateUnlock(phaseDiv) {
        const unlockGif = document.createElement('img');
        unlockGif.src = '../../imagens/cadeado.gif';
        unlockGif.classList.add('unlock-gif');
        phaseDiv.appendChild(unlockGif);

        const unlockSound = new Audio('../../imagens/unlock-padlock.mp3');
        unlockSound.play(); // Toca o som de desbloqueio

        setTimeout(() => {
            unlockGif.remove();
        }, 3000);
    }

    function moveToPhase(index, path = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();

        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        player.classList.add('moving');

        if (path) {
            setTimeout(() => {
                window.location.href = path;
            }, 600);
        }
    }

    function scrollToPhase(index) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        window.scrollTo({
            top: coords.top + window.scrollY - window.innerHeight / 2,
            behavior: 'smooth'
        });
    }

    function drawLines() {
        svgContainer.innerHTML = '';
        const phases = document.querySelectorAll('.phase');
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = phases[i];
            const phase2 = phases[i + 1];
            if (!phase1 || !phase2) continue;

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
});
