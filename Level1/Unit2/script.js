// script.js

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM completamente carregado. Iniciando configuração...");

    // 1️⃣ Lê o parâmetro 'trecho' da URL
    const params = new URLSearchParams(window.location.search);
    const trechoSelecionado = params.get("trecho");
    console.log("Trecho selecionado via URL:", trechoSelecionado);

    // 2️⃣ Referências principais
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

    // 3️⃣ Extrai Level e Unit da URL atual
    // Ex: pathname "/level0/unit1/fases" → ["", "level0", "unit1", "fases"]
    const urlPathParts = window.location.pathname.split('/');
    const capitalizeFirstLetter = str =>
        str
            ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
            : '';
    const currentLevel = capitalizeFirstLetter(urlPathParts[1] || '');
    const currentUnit = capitalizeFirstLetter(urlPathParts[2] || '');

    console.log(`Nível atual: ${currentLevel}, Unidade atual: ${currentUnit}`);
    console.log("Path completo:", window.location.pathname);

    // 4️⃣ Obtem atividades dinamicamente com base no trecho selecionado
    const activities = getActivitiesByTrecho(trechoSelecionado, currentLevel, currentUnit);
    console.log("Atividades configuradas:", activities);
    if (!activities.length) {
        console.warn(`Nenhuma atividade encontrada para trecho="${trechoSelecionado}".`);
    }

    // 5️⃣ Atualiza texto de nível/unidade na interface
    levelUnitInfo.innerHTML = `
        ${currentLevel}<br>
        ${currentUnit}
    `;
    console.log("Informações de nível e unidade atualizadas na interface.");

    // 6️⃣ Fecha o dropdown ao clicar fora dele
    document.addEventListener("click", function(event) {
        if (
            !userDropdown.contains(event.target) &&
            !loginContainer.contains(event.target)
        ) {
            userDropdown.style.display = 'none';
            console.log("Dropdown fechado.");
        }
    });

    // 7️⃣ Caso de usuário autenticado ou não:
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            const userId = user.uid;

            database
                .ref('/usuarios/' + userId)
                .once('value')
                .then(snapshot => {
                    const userData = snapshot.val();
                    console.log("Dados do usuário:", userData);

                    const userName = userData.nome || user.email;
                    const userAvatar = userData.avatar
                        ? `../../imagens/${userData.avatar}`
                        : '../../imagens/bonequinho.png';

                    // Atualiza UI com nome e avatar
                    loginLink.innerHTML = `
                        <img src="${userAvatar}" alt="User Icon" class="user-icon">
                        <p class="user-name">${userName}</p>
                    `;
                    loginLink.removeAttribute('href');

                    // Monta opções de dashboard conforme função
                    let dashboardLink = '';
                    if (
                        userData.role === 'proprietario' ||
                        userData.role === 'professor'
                    ) {
                        dashboardLink =
                            userData.role === 'proprietario'
                                ? '<a href="../../painel_proprietario.html" class="dropdown-item">OWNER DASHBOARD</a>'
                                : '<a href="../../painel_professor.html" class="dropdown-item">TEACHER DASHBOARD</a>';
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

                    // Toggle do dropdown ao clicar no loginContainer
                    loginContainer.addEventListener("click", function(event) {
                        if (event.target.tagName !== 'A') {
                            userDropdown.style.display =
                                userDropdown.style.display === 'flex' ? 'none' : 'flex';
                            console.log("Dropdown alternado:", userDropdown.style.display);
                        }
                    });

                    // Carrega progresso e, em seguida, inicializa o mapa
                    console.log("Carregando progresso do usuário...");
                    loadUserProgress(userId, userAvatar, userData.role);
                })
                .catch(error => {
                    console.error("Erro ao carregar dados do usuário:", error);
                    // Mesmo se houver erro no Firebase, mostra fases básicas (bloqueadas)
                    initializeMap('../../imagens/bonequinho.png');
                });
        } else {
            console.log("Nenhum usuário autenticado.");
            // Deixa o link apontando para login
            loginLink.setAttribute('href', 'Formulario/login.html');

            // Exibe fases básicas mesmo sem usuário (todas bloqueadas)
            initializeMap('../../imagens/bonequinho.png');
        }
    });

    // 8️⃣ Função para carregar o progresso do usuário
    function loadUserProgress(userId, userAvatar, userRole) {
        const progressPath = `/usuarios/${userId}/progresso/${currentLevel}/${currentUnit}`;
        console.log(`Buscando progresso em: ${progressPath}`);

        if (userRole === 'proprietario' || userRole === 'professor') {
            // Proprietário/professor libera todas as atividades
            activities.forEach(activity => (activity.unlocked = true));
            lastUnlockedIndex = activities.length - 1;
            initializeMap(userAvatar);
        } else {
            database
                .ref(progressPath)
                .once('value')
                .then(snapshot => {
                    const progress = snapshot.val() || {};
                    console.log("Progresso encontrado:", progress);

                    activities.forEach((activity, index) => {
                        // Chave de fase: ex. "fase1", ou apenas "1" no Firebase
                        const faseKey = Object.keys(progress).find(
                            key =>
                                key.includes(`fase${activity.id}`) ||
                                key.includes(activity.id.toString())
                        );

                        // Libera se a fase estiver marcada como true e a anterior desbloqueada
                        if (faseKey && progress[faseKey] === true) {
                            activity.unlocked =
                                index === 0 || activities[index - 1].unlocked;
                            if (activity.unlocked) {
                                lastUnlockedIndex = index;
                            }
                        }
                        console.log(`Fase ${activity.id} - liberada? ${activity.unlocked}`);
                    });

                    initializeMap(userAvatar);
                })
                .catch(error => {
                    console.error("Erro no Firebase:", error);
                    initializeMap(userAvatar);
                });
        }
    }

    // 9️⃣ Função para inicializar o mapa e desenhar fases
    function initializeMap(avatarPath) {
        console.log("Inicializando mapa...");
        window.scrollTo(0, 0);

        // Limpa fases atuais (caso haja)
        document.querySelectorAll('.phase').forEach(phase => phase.remove());

        // Calcula baseTopPosition (logo abaixo do título)
        const titleContainer = document.querySelector('.title-container');
        const titleBottom = titleContainer.offsetTop + titleContainer.offsetHeight;
        const baseTopPosition = titleBottom + 20; // 20px de espaçamento

        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');

            // Calcula posição vertical (percentual) e horizontal (alternate)
            const isLandscape = window.innerWidth > window.innerHeight;
            const spacingPercent = isLandscape ? 30 : 20;
            const topPosition =
                baseTopPosition + index * (spacingPercent * window.innerHeight / 100);
            const maxOffset = 400; // máximo de 400px a partir do centro
            const screenCenter = window.innerWidth / 2;
            const offset = Math.min(window.innerWidth * 0.4, maxOffset);
            const horizontalPositionPx =
                screenCenter + (index % 2 === 0 ? -offset : offset);

            phaseDiv.style.left = `${horizontalPositionPx}px`;
            phaseDiv.style.top = `${topPosition}px`;

            // Imagem da fase
            const phaseImage = document.createElement('img');
            phaseImage.src = activity.img;
            phaseImage.alt = activity.name;
            phaseImage.classList.add('phase-img');
            phaseDiv.appendChild(phaseImage);

            // Se estiver destravada, adiciona classe "active"; caso contrário, "locked"
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

            // Ao clicar em uma fase destravada, redireciona para activity.path
            phaseDiv.addEventListener('click', () => {
                if (activity.unlocked) {
                    console.log(`Fase ${activity.id} clicada. Redirecionando para: ${activity.path}`);
                    moveToPhase(index, activity.path);
                } else {
                    console.log(`Fase ${activity.id} está bloqueada. Ignorando clique.`);
                }
            });

            mapContainer.appendChild(phaseDiv);
        });

        drawLines();
        createPlayer(avatarPath);

        if (lastUnlockedIndex >= 0) {
            console.log(`Última fase desbloqueada: índice ${lastUnlockedIndex}. Posicionando jogador...`);
            const lastUnlockedPhase = document.querySelectorAll('.phase')[lastUnlockedIndex];
            animateUnlock(lastUnlockedPhase);
            scrollToPhase(lastUnlockedIndex);
        } else {
            console.log("Nenhuma fase desbloqueada ainda.");
        }
    }

    // 1️⃣0️⃣ Função para criar o "jogador" (avatar) no mapa
    function createPlayer(avatarPath) {
        console.log(`Criando jogador com avatar: ${avatarPath}`);
        if (!player) {
            player = document.createElement('img');
            player.classList.add('player');
            mapContainer.appendChild(player);
        }
        player.src = avatarPath;
        // Posiciona no centro da primeira fase desbloqueada ou no índice 0
        moveToPhase(lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0);
    }

    // 1️⃣1️⃣ Função para mover o jogador e, se houver "path", redireciona
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

    // 1️⃣2️⃣ Função para desenhar linhas entre fases
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

            // Pontos de controle para curva suave
            const controlPointX1 = coords1.left + (coords2.left - coords1.left) * 0.33;
            const controlPointY1 = coords1.top + (coords2.top - coords1.top) * 0.33 + 150;
            const controlPointX2 = coords1.left + (coords2.left - coords1.left) * 0.66;
            const controlPointY2 = coords2.top - 150;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `
                M ${coords1.left + coords1.width / 2} ${coords1.top + coords1.height / 2}
                C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2},
                  ${coords2.left + coords2.width / 2} ${coords2.top + coords2.height / 2}
            `;
            path.setAttribute('d', d);
            path.setAttribute('class', 'path path-blue');
            svgContainer.appendChild(path);
        }
    }

    // 1️⃣3️⃣ Função para animar desbloqueio (GIF + som)
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

    // 1️⃣4️⃣ Função para rolar suavemente até a fase especificada
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
