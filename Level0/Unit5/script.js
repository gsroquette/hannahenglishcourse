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
    const urlPathParts = window.location.pathname.split('/');
    const capitalizeFirstLetter = str =>
        str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
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
    levelUnitInfo.innerHTML = `${currentLevel}<br>${currentUnit}`;
    console.log("Informações de nível e unidade atualizadas na interface.");

    // 6️⃣ Fecha o dropdown ao clicar fora dele
    document.addEventListener("click", function(event) {
        if (!userDropdown.contains(event.target) && !loginContainer.contains(event.target)) {
            userDropdown.style.display = 'none';
            console.log("Dropdown fechado.");
        }
    });

    // ---- Helpers novos (robustez de layout) -----------------------------

    // Aguarda todas as imagens das fases estarem carregadas
    function onAllPhaseImagesReady() {
        const imgs = Array.from(mapContainer.querySelectorAll('img.phase-img'));
        const pending = imgs.filter(img => !img.complete || img.naturalWidth === 0);
        if (pending.length === 0) return Promise.resolve();
        return Promise.all(
            pending.map(img => new Promise(res => { img.onload = img.onerror = res; }))
        );
    }

    // Debounce simples para resize/orientation
    function debounce(fn, ms = 120) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // Ajusta altura do container para caber a fase mais baixa e sincroniza o SVG
    function fitContainerToPhases(padding = 200) {
        const phases = Array.from(document.querySelectorAll('.phase'));
        if (phases.length === 0) return;

        // ponto mais baixo (em coordenadas do container)
        const mapRect = mapContainer.getBoundingClientRect();
        const bottoms = phases.map(p => {
            const r = p.getBoundingClientRect();
            const yInMap = (r.top - mapRect.top) + r.height; // base do elemento dentro do container
            return yInMap;
        });

        const maxBottom = Math.max(...bottoms);
        const minHeight = Math.max(window.innerHeight, Math.ceil(maxBottom + padding));

        // Define altura explícita
        mapContainer.style.minHeight = '100svh'; // garante pelo menos uma tela
        mapContainer.style.height = `${minHeight}px`;

        // Sincroniza SVG com o container
        const w = mapContainer.clientWidth;
        const h = mapContainer.clientHeight;
        svgContainer.setAttribute('width', w);
        svgContainer.setAttribute('height', h);
        svgContainer.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svgContainer.setAttribute('preserveAspectRatio', 'none');
    }

    // Centro de uma fase em coordenadas do container
    function phaseCenterInMap(phaseEl) {
        const mapRect = mapContainer.getBoundingClientRect();
        const r = phaseEl.getBoundingClientRect();
        return {
            x: (r.left - mapRect.left) + r.width / 2,
            y: (r.top - mapRect.top) + r.height / 2
        };
    }

    // 7️⃣ Caso de usuário autenticado ou não:
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            const userId = user.uid;

            database.ref('/usuarios/' + userId).once('value')
                .then(snapshot => {
                    const userData = snapshot.val();
                    console.log("Dados do usuário:", userData);

                    const userName = userData.nome || user.email;
                    const userAvatar = userData.avatar ? `../../imagens/${userData.avatar}` : '../../imagens/bonequinho.png';

                    // Atualiza UI com nome e avatar
                    loginLink.innerHTML = `
                        <img src="${userAvatar}" alt="User Icon" class="user-icon">
                        <p class="user-name">${userName}</p>
                    `;
                    loginLink.removeAttribute('href');

                    // Monta opções de dashboard conforme função
                    let dashboardLink = '';
                    if (userData.role === 'proprietario' || userData.role === 'professor') {
                        dashboardLink = userData.role === 'proprietario'
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
                            userDropdown.style.display = userDropdown.style.display === 'flex' ? 'none' : 'flex';
                            console.log("Dropdown alternado:", userDropdown.style.display);
                        }
                    });

                    // Carrega progresso e, em seguida, inicializa o mapa
                    console.log("Carregando progresso do usuário...");
                    loadUserProgress(userId, userAvatar, userData.role);
                })
                .catch(error => {
                    console.error("Erro ao carregar dados do usuário:", error);
                    initializeMap('../../imagens/bonequinho.png');
                });
        } else {
            console.log("Nenhum usuário autenticado.");
            loginLink.setAttribute('href', 'Formulario/login.html');
            initializeMap('../../imagens/bonequinho.png');
        }
    });

    // 8️⃣ Função para carregar o progresso do usuário
    function loadUserProgress(userId, userAvatar, userRole) {
        const progressPath = `/usuarios/${userId}/progresso/${currentLevel}/${currentUnit}`;
        console.log(`Buscando progresso em: ${progressPath}`);

        if (userRole === 'proprietario' || userRole === 'professor') {
            activities.forEach(activity => (activity.unlocked = true));
            lastUnlockedIndex = activities.length - 1;
            initializeMap(userAvatar);
        } else {
            database.ref(progressPath).once('value')
                .then(snapshot => {
                    const progress = snapshot.val() || {};
                    console.log("Progresso encontrado:", progress);

                    activities.forEach((activity, index) => {
                        const faseKey = Object.keys(progress).find(
                            key => key.includes(`fase${activity.id}`) || key.includes(activity.id.toString())
                        );
                        if (faseKey && progress[faseKey] === true) {
                            activity.unlocked = index === 0 || activities[index - 1].unlocked;
                            if (activity.unlocked) lastUnlockedIndex = index;
                        }
                        console.log(`Fase ${activity.id} - liberada? ${!!activity.unlocked}`);
                    });

                    initializeMap(userAvatar);
                })
                .catch(error => {
                    console.error("Erro no Firebase:", error);
                    initializeMap(userAvatar);
                });
        }
    }

    // 9️⃣ Inicializa o mapa, posiciona fases e só depois desenha
    function initializeMap(avatarPath) {
        console.log("Inicializando mapa...");
        window.scrollTo(0, 0);

        // Limpa fases atuais (caso haja)
        document.querySelectorAll('.phase').forEach(phase => phase.remove());

        // Calcula baseTopPosition (logo abaixo do título)
        const titleContainer = document.querySelector('.title-container');
        const titleBottom = titleContainer.offsetTop + titleContainer.offsetHeight;
        const baseTopPosition = titleBottom + 20; // 20px de espaçamento

        // Renderiza as fases
        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');

            const isLandscape = window.innerWidth > window.innerHeight;
            const spacingPercent = isLandscape ? 30 : 20;
            const topPosition = baseTopPosition + index * (spacingPercent * window.innerHeight / 100);

            const maxOffset = 400;
            const screenCenter = window.innerWidth / 2;
            const offset = Math.min(window.innerWidth * 0.4, maxOffset);
            const horizontalPositionPx = screenCenter + (index % 2 === 0 ? -offset : offset);

            phaseDiv.style.left = `${horizontalPositionPx}px`;
            phaseDiv.style.top = `${topPosition}px`;

            // Imagem da fase
            const phaseImage = document.createElement('img');
            phaseImage.src = activity.img;
            phaseImage.alt = activity.name;
            phaseImage.classList.add('phase-img');
            phaseDiv.appendChild(phaseImage);

            // Estado (bloqueada ou ativa)
            if (activity.unlocked) {
                phaseDiv.classList.add('active');
            } else {
                phaseDiv.classList.add('locked');
                const lockIcon = document.createElement('img');
                lockIcon.src = '../../imagens/lock_icon_resized.png';
                lockIcon.classList.add('lock-icon');
                phaseDiv.appendChild(lockIcon);
            }

            // Clique
            phaseDiv.addEventListener('click', () => {
                if (activity.unlocked) {
                    moveToPhase(index, activity.path);
                }
            });

            mapContainer.appendChild(phaseDiv);
        });

        // Só depois que as imagens carregarem, ajusta container, desenha e posiciona o player
        onAllPhaseImagesReady().then(() => {
            fitContainerToPhases(); // garante altura suficiente para muitas fases
            drawLines();            // desenha com coordenadas do container
            createPlayer(avatarPath);

            if (lastUnlockedIndex >= 0) {
                const lastUnlockedPhase = document.querySelectorAll('.phase')[lastUnlockedIndex];
                animateUnlock(lastUnlockedPhase);
                scrollToPhase(lastUnlockedIndex);
            }
        });
    }

    // 🔟 Cria o "jogador" (avatar) no mapa
    function createPlayer(avatarPath) {
        if (!player) {
            player = document.createElement('img');
            player.classList.add('player');
            mapContainer.appendChild(player);
        }
        player.src = avatarPath;
        moveToPhase(lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0);
    }

    // 1️⃣1️⃣ Move o jogador; se houver path, redireciona após a animação
    function moveToPhase(index, path = null) {
        const phases = document.querySelectorAll('.phase');
        const phase = phases[index];
        if (!phase) {
            console.error(`Fase de índice ${index} não encontrada.`);
            return;
        }

        const mapRect = mapContainer.getBoundingClientRect();
        const r = phase.getBoundingClientRect();
        const xInMap = (r.left - mapRect.left) + r.width / 2;
        const yInMap = (r.top - mapRect.top) + r.height / 2;

        player.style.left = `${xInMap}px`;
        player.style.top  = `${yInMap}px`;

        if (path) {
            setTimeout(() => { window.location.href = path; }, 600);
        }
    }

    // 1️⃣2️⃣ Desenha linhas entre fases usando coords do container
    function drawLines() {
        svgContainer.innerHTML = '';
        const phases = Array.from(document.querySelectorAll('.phase'));
        if (phases.length < 2) return;

        // Garante que SVG está sincronizado com o container
        fitContainerToPhases();

        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = phases[i];
            const phase2 = phases[i + 1];
            if (!phase1 || !phase2) continue;

            const a = phaseCenterInMap(phase1);
            const b = phaseCenterInMap(phase2);

            // Curva suave (Bezier) com controles em função da distância
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const c1 = { x: a.x + dx * 0.33, y: a.y + dy * 0.33 + 150 };
            const c2 = { x: a.x + dx * 0.66, y: b.y - 150 };

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
            path.setAttribute('d', d);
            path.setAttribute('class', 'path-blue');
            svgContainer.appendChild(path);
        }
    }

    // 1️⃣3️⃣ Anima desbloqueio (GIF + som)
    function animateUnlock(phaseDiv) {
        const unlockGif = document.createElement('img');
        unlockGif.src = '../../imagens/cadeado.gif';
        unlockGif.classList.add('unlock-gif');
        phaseDiv.appendChild(unlockGif);

        const unlockSound = new Audio('../../imagens/unlock-padlock.mp3');
        unlockSound.play();

        setTimeout(() => { unlockGif.remove(); }, 3000);
    }

    // 1️⃣4️⃣ Rolagem suave até a fase
    function scrollToPhase(index) {
        const phase = document.querySelectorAll('.phase')[index];
        if (!phase) return;
        const r = phase.getBoundingClientRect();
        const target = r.top + window.scrollY - window.innerHeight / 2;
        window.scrollTo({ top: target, behavior: 'smooth' });
    }

    // 🔁 Redesenhar em resize/orientação (sem recarregar a página)
    const onResize = debounce(() => {
        fitContainerToPhases();
        drawLines();
        // reposiciona o player na fase atual/última desbloqueada
        moveToPhase(Math.max(0, lastUnlockedIndex));
    }, 120);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
});
