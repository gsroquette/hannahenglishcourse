document.addEventListener('DOMContentLoaded', function() {
    const database = firebase.database();
    const auth = firebase.auth();
    const loginLink = document.getElementById("loginLink");
    const loginContainer = document.getElementById("loginContainer"); // Definido fora do bloco de autenticação
    const userDropdown = document.getElementById("userDropdown");
    const levelUnitInfo = document.getElementById("levelUnitInfo");
    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let player;
    let lastUnlockedIndex = -1;

    // Extraindo Level e Unit da URL atual
    const urlPathParts = window.location.pathname.split('/');
    const capitalizeFirstLetter = str => str.charAt(0).toUpperCase() + str.slice(1);
    const currentLevel = capitalizeFirstLetter(urlPathParts[1]);
    const currentUnit = capitalizeFirstLetter(urlPathParts[2]);

const activities = [
    { id: 19, name: "GrammarDialogo", path: `/Atividades/GrammarDialogo/index.html?level=${currentLevel}&unit=${currentUnit}&fase=19`, img: "../../imagens/botoes/conversation_button.png", unlocked: false },
    { id: 20, name: "QUIZ_IMAGE2", path: `/Atividades/QUIZ_IMAGE2/index.html?level=${currentLevel}&unit=${currentUnit}&fase=20`, img: "../../imagens/botoes/quiz_button.png", unlocked: false },
    { id: 21, name: "Diálogo", path: `/Atividades/Dialogo/index.html?level=${currentLevel}&unit=${currentUnit}&fase=21`, img: "../../imagens/botoes/dialogo_button.png", unlocked: false },    
];

    // Fechar o dropdown ao clicar fora dele
    document.addEventListener("click", function(event) {
        if (!userDropdown.contains(event.target) && !loginContainer.contains(event.target)) {
            userDropdown.style.display = 'none';
        }
    });

    // Configuração de autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            const userId = user.uid;
            database.ref('/usuarios/' + userId).once('value').then(snapshot => {
                const userData = snapshot.val();
                const userName = userData.nome || user.email;
                const userAvatar = userData.avatar ? `../../imagens/${userData.avatar}` : '../../imagens/bonequinho.png';

                // Atualiza a interface do usuário com nome e avatar
                loginLink.innerHTML = `<img src="${userAvatar}" alt="User Icon" class="user-icon"><p class="user-name">${userName}</p>`;
                loginLink.removeAttribute('href');

                let dashboardLink = '';
                if (userData.role === 'proprietario' || userData.role === 'professor') {
                    dashboardLink = userData.role === 'proprietario' ? 
                                    '<a href="../../painel_proprietario.html" class="dropdown-item">OWNER DASHBOARD</a>' : 
                                    '<a href="../../painel_professor.html" class="dropdown-item">TEACHER DASHBOARD</a>';
                } else if (userData.role === 'aluno') {
                    dashboardLink = '<a href="../../painel_aluno.html" class="dropdown-item">STUDENT DASHBOARD</a>';
                }

                userDropdown.innerHTML = `
                    ${dashboardLink}
                    <a href="/index.html" class="dropdown-item">SELECT A NEW LEVEL</a>
                    <a href="/${currentLevel}/index.html" class="dropdown-item">SELECT A NEW UNIT</a>
                    <a href="/${currentLevel}/${currentUnit}/index.html" class="dropdown-item">SELECT A NEW ACTIVITY</a>
                `;
                
                // Evento de clique no loginContainer para abrir/fechar o dropdown
                loginContainer.addEventListener("click", function(event) {
                    if (event.target.tagName !== 'A') {
                        userDropdown.style.display = userDropdown.style.display === 'flex' ? 'none' : 'flex';
                    }
                });

                // Carrega o progresso do usuário e define o avatar no mapa
                loadUserProgress(userId, userAvatar, userData.role);
            });
        } else {
            loginLink.setAttribute('href', 'Formulario/login.html');
        }
    });

    // Atualiza o texto com o nível e a unidade atual
    levelUnitInfo.innerHTML = `
          ${currentLevel}<br>
          ${currentUnit}
    `;

    // Função para carregar o progresso do usuário
   function loadUserProgress(userId, userAvatar, userRole) {
    const progressPath = `/usuarios/${userId}/progresso/${currentLevel}/${currentUnit}`;
    console.log(`Buscando progresso em: ${progressPath}`);

    if (userRole === 'proprietario' || userRole === 'professor') {
        activities.forEach(activity => activity.unlocked = true);
        lastUnlockedIndex = activities.length - 1;
        initializeMap(userAvatar);
    } else {
        database.ref(progressPath).once('value').then(snapshot => {
            const progress = snapshot.val();
            console.log("Progresso encontrado:", progress);

            activities.forEach((activity, index) => {
                // Verifica se a fase está liberada no Firebase
                const faseKey = Object.keys(progress || {}).find(
                    key => key.includes(`fase${activity.id}`) || key.includes(activity.id.toString())
                );
                
                // Libera apenas se estiver marcada como true E a anterior estiver completa
                if (faseKey && progress[faseKey] === true) {
                    activity.unlocked = (index === 0) || activities[index-1].unlocked; // <<--- REGRA FUNDAMENTAL
                    if (activity.unlocked) lastUnlockedIndex = index;
                }

                console.log(`Fase ${activity.id} - liberada? ${activity.unlocked}`);
            });

            initializeMap(userAvatar);
        }).catch(error => {
            console.error("Erro no Firebase:", error);
            initializeMap(userAvatar);
        });
    }
}

    // Função para inicializar o mapa
    function initializeMap(userAvatar) {
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
        createPlayer(userAvatar);

        if (lastUnlockedIndex >= 0) {
            const lastUnlockedPhase = document.querySelectorAll('.phase')[lastUnlockedIndex];
            animateUnlock(lastUnlockedPhase);
            scrollToPhase(lastUnlockedIndex);
        }
    }

    function createPlayer(avatarPath) {
        if (!player) {
            player = document.createElement('img');
            player.classList.add('player');
            mapContainer.appendChild(player);
        }
        player.src = avatarPath;
        moveToPhase(lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0);
    }

    function moveToPhase(index, path = null) {
        const phase = document.querySelectorAll('.phase')[index];
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
            path.setAttribute('class', 'path path-blue');
            svgContainer.appendChild(path);
        }
    }

    function animateUnlock(phaseDiv) {
        const unlockGif = document.createElement('img');
        unlockGif.src = '../../imagens/cadeado.gif';
        unlockGif.classList.add('unlock-gif');
        phaseDiv.appendChild(unlockGif);

        const unlockSound = new Audio('../../imagens/unlock-padlock.mp3');
        unlockSound.play();

        setTimeout(() => {
            unlockGif.remove();
        }, 3000);
    }

    function scrollToPhase(index) {
        const phase = document.querySelectorAll('.phase')[index];
        if (phase) {
            const coords = phase.getBoundingClientRect();
            window.scrollTo({
                top: coords.top + window.scrollY - window.innerHeight / 2,
                behavior: 'smooth'
            });
        }
    }
});
