document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM completamente carregado. Iniciando configuração...");
    
    const database = firebase.database();
    const auth = firebase.auth();
    const loginLink = document.getElementById("loginLink");
    const loginContainer = document.getElementById("loginContainer");
    const userDropdown = document.getElementById("userDropdown");
    const levelUnitInfo = document.getElementById("levelUnitInfo");
    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let player;
    let lastUnlockedIndex = -1;

    console.log("Elementos da DOM capturados com sucesso.");

    // Extraindo Level e Unit da URL atual
    const urlPathParts = window.location.pathname.split('/');
    const capitalizeFirstLetter = str => str.charAt(0).toUpperCase() + str.slice(1);
    const currentLevel = capitalizeFirstLetter(urlPathParts[1] || '');
    const currentUnit = capitalizeFirstLetter(urlPathParts[2] || '');

    console.log(`Nível atual: ${currentLevel}, Unidade atual: ${currentUnit}`);

    const activities = [
        { id: 1, name: "StoryCards", path: `/Atividades/StoryCards/index.html?level=${currentLevel}&unit=${currentUnit}&fase=1`, img: "../../imagens/botoes/storycards_button.png", unlocked: false },
        { id: 2, name: "Flashcards", path: `/Atividades/Flashcards/index.html?level=${currentLevel}&unit=${currentUnit}&fase=2`, img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 3, name: "Flashcards2", path: `/Atividades/Flashcards2/index.html?level=${currentLevel}&unit=${currentUnit}&fase=3`, img: "../../imagens/botoes/flashcards_button.png", unlocked: false },   
        { id: 4, name: "Fill in the Blanks", path: `/Atividades/Fill%20in%20the%20Blanks/index.html?level=${currentLevel}&unit=${currentUnit}&fase=4`, img: "../../imagens/botoes/fillintheblanks_button.png", unlocked: false },
    ];

    console.log("Atividades configuradas:", activities);

    // Fechar o dropdown ao clicar fora dele
    document.addEventListener("click", function(event) {
        if (!userDropdown.contains(event.target) && !loginContainer.contains(event.target)) {
            userDropdown.style.display = 'none';
            console.log("Dropdown fechado.");
        }
    });

    // Configuração de autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            const userId = user.uid;
            database.ref('/usuarios/' + userId).once('value').then(snapshot => {
                const userData = snapshot.val();
                console.log("Dados do usuário:", userData);
                const userName = userData.nome || user.email;
                const userAvatar = userData.avatar ? `../../imagens/${userData.avatar}` : '../../imagens/bonequinho.png';

                console.log(`Avatar do usuário: ${userAvatar}, Nome: ${userName}`);

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
                
                console.log("Dropdown do usuário configurado.");

                // Evento de clique no loginContainer para abrir/fechar o dropdown
                loginContainer.addEventListener("click", function(event) {
                    if (event.target.tagName !== 'A') {
                        userDropdown.style.display = userDropdown.style.display === 'flex' ? 'none' : 'flex';
                        console.log("Dropdown alternado:", userDropdown.style.display);
                    }
                });

                // Carrega o progresso do usuário e define o avatar no mapa
                console.log("Carregando progresso do usuário...");
                loadUserProgress(userId, userAvatar, userData.role);
            }).catch(error => {
                console.error("Erro ao carregar dados do usuário:", error);
            });
        } else {
            console.log("Nenhum usuário autenticado. Redirecionando para login.");
            loginLink.setAttribute('href', 'Formulario/login.html');
        }
    });

    // Atualiza o texto com o nível e a unidade atual
    levelUnitInfo.innerHTML = `
          ${currentLevel}<br>
          ${currentUnit}
    `;
    console.log("Informações de nível e unidade atualizadas na interface.");

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
                        activity.unlocked = (index === 0) || activities[index-1].unlocked;
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
        console.log("Inicializando mapa...");
        window.scrollTo(0, 0);
        
        // Remove fases existentes
        document.querySelectorAll('.phase').forEach(phase => phase.remove());

        // 1. Calcula o final exato do bloco de título dentro de mapContainer
        const titleContainer = document.querySelector('.title-container');
        const titleBottom = titleContainer.offsetTop + titleContainer.offsetHeight;
        // Espaçamento extra de 20px abaixo do título
        const baseTopPosition = titleBottom + 20;

        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');

            // Posiciona cada fase a partir de baseTopPosition
            const topPosition = baseTopPosition + index * (20 * window.innerHeight / 100);
            const horizontalPosition = index % 2 === 0 ? 10 : 85;
            phaseDiv.style.top = `${topPosition}px`;
            phaseDiv.style.left = `${horizontalPosition}%`;

            const phaseImage = document.createElement('img');
            phaseImage.src = activity.img;
            phaseImage.alt = activity.name;
            phaseImage.classList.add('phase-img');
            phaseDiv.appendChild(phaseImage);

            mapContainer.appendChild(phaseDiv);

            if (activity.unlocked) {
                console.log(`Renderizando fase ${activity.id} como desbloqueada.`);
                phaseDiv.classList.add('active');
            } else {
                console.log(`Renderizando fase ${activity.id} como bloqueada.`);
                phaseDiv.classList.add('locked');
                const lockIcon = document.createElement('img');
                lockIcon.src = '../../imagens/lock_icon_resized.png';
                lockIcon.classList.add('lock-icon');
                phaseDiv.appendChild(lockIcon);
            }

            phaseDiv.addEventListener('click', () => {
                if (activity.unlocked) {
                    console.log(`Fase ${activity.id} clicada. Redirecionando para: ${activity.path}`);
                    moveToPhase(index, activity.path);
                } else {
                    console.log(`Fase ${activity.id} está bloqueada. Ignorando clique.`);
                }
            });
        });

        drawLines();
        createPlayer(userAvatar);

        if (lastUnlockedIndex >= 0) {
            console.log(`Última fase desbloqueada: índice ${lastUnlockedIndex}. Posicionando jogador...`);
            const lastUnlockedPhase = document.querySelectorAll('.phase')[lastUnlockedIndex];
            animateUnlock(lastUnlockedPhase);
            scrollToPhase(lastUnlockedIndex);
        } else {
            console.log("Nenhuma fase desbloqueada ainda.");
        }
    }

    function createPlayer(avatarPath) {
        console.log(`Criando jogador com avatar: ${avatarPath}`);
        if (!player) {
            player = document.createElement('img');
            player.classList.add('player');
            mapContainer.appendChild(player);
        }
        player.src = avatarPath;
        moveToPhase(lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0);
    }

    function moveToPhase(index, path = null) {
        console.log(`Movendo jogador para fase de índice ${index}`);
        const phase = document.querySelectorAll('.phase')[index];
        if (!phase) {
            console.error(`Fase de índice ${index} não encontrada.`);
            return;
        }

        const coords = phase.getBoundingClientRect();
        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;

        if (path) {
            console.log(`Agendando redirecionamento para: ${path}`);
            setTimeout(() => {
                window.location.href = path;
            }, 600);
        }
    }

    function drawLines() {
        console.log("Desenhando linhas entre fases...");
        svgContainer.innerHTML = '';
        const phases = document.querySelectorAll('.phase');
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = phases[i];
            const phase2 = phases[i + 1];
            if (!phase1 || !phase2) {
                console.error(`Fase ${i} ou ${i + 1} não encontrada para desenhar linha.`);
                continue;
            }

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
        console.log("Animando desbloqueio de fase...");
        const unlockGif = document.createElement('img');
        unlockGif.src = '../../imagens/cadeado.gif';
        unlockGif.classList.add('unlock-gif');
        phaseDiv.appendChild(unlockGif);

        const unlockSound = new Audio('../../imagens/unlock-padlock.mp3');
        unlockSound.play();

        setTimeout(() => {
            unlockGif.remove();
            console.log("Animação de desbloqueio concluída.");
        }, 3000);
    }

    function scrollToPhase(index) {
        console.log(`Rolando página para fase de índice ${index}...`);
        const phase = document.querySelectorAll('.phase')[index];
        if (phase) {
            const coords = phase.getBoundingClientRect();
            window.scrollTo({
                top: coords.top + window.scrollY - window.innerHeight / 2,
                behavior: 'smooth'
            });
        } else {
            console.error(`Fase de índice ${index} não encontrada para rolagem.`);
        }
    }
});
