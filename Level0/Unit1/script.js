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

    // Controle extra da turma
    let classLimitActiveForStudent = false;
    let currentClassLevelLimit = null;

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

    // Mensagem visual de bloqueio por professor/turma
    const permissionMessage = document.createElement("div");
    permissionMessage.id = "permissionMessage";
    permissionMessage.style.display = "none";
    permissionMessage.style.width = "min(90%, 620px)";
    permissionMessage.style.margin = "10px auto";
    permissionMessage.style.padding = "12px 16px";
    permissionMessage.style.borderRadius = "12px";
    permissionMessage.style.background = "#fff3cd";
    permissionMessage.style.border = "1px solid #ffe08a";
    permissionMessage.style.color = "#5d4037";
    permissionMessage.style.fontFamily = "Arial, sans-serif";
    permissionMessage.style.fontWeight = "700";
    permissionMessage.style.lineHeight = "1.4";
    permissionMessage.style.textAlign = "center";
    permissionMessage.style.boxShadow = "0 4px 10px rgba(0,0,0,0.08)";

    const titleContainerForMessage = document.querySelector(".title-container");
    if (titleContainerForMessage && titleContainerForMessage.parentNode) {
        titleContainerForMessage.insertAdjacentElement("afterend", permissionMessage);
    }

    function setPermissionMessage(message) {
        const msg = document.getElementById("permissionMessage");
        if (!msg) return;

        if (message) {
            msg.textContent = message;
            msg.style.display = "block";
        } else {
            msg.textContent = "";
            msg.style.display = "none";
        }
    }

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

        const mapRect = mapContainer.getBoundingClientRect();
        const bottoms = phases.map(p => {
            const r = p.getBoundingClientRect();
            const yInMap = (r.top - mapRect.top) + r.height;
            return yInMap;
        });

        const maxBottom = Math.max(...bottoms);
        const minHeight = Math.max(window.innerHeight, Math.ceil(maxBottom + padding));

        mapContainer.style.minHeight = '100svh';
        mapContainer.style.height = `${minHeight}px`;

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

    // ===== Helpers da nova regra de turma/professor =====

    function getUnitNumber(unitValue) {
        if (!unitValue) return null;
        const match = String(unitValue).match(/unit\s*(\d+)/i);
        if (match && match[1]) return Number(match[1]);
        return null;
    }

    function getLevelNumber(levelValue) {
        if (!levelValue) return null;
        const match = String(levelValue).match(/level\s*(\d+)/i);
        if (match && match[1]) return Number(match[1]);
        return null;
    }

    function getLevelStartNumber(levelValue) {
        const levelNumber = getLevelNumber(levelValue);

        if (levelNumber === 0) return 1;
        if (levelNumber === 1) return 1001;
        if (levelNumber === 2) return 2001;
        if (levelNumber === 3) return 3001;
        if (levelNumber === 4) return 4001;

        return 1001;
    }

    function getLevelLimitFromClassAccess(limits, levelDB) {
        if (!limits || typeof limits !== "object") return null;

        const limit = limits[levelDB];

        if (
            limit &&
            limit.enabled === true &&
            limit.unit &&
            limit.phase &&
            typeof limit.order !== "undefined" &&
            typeof limit.phaseNumber !== "undefined"
        ) {
            return limit;
        }

        return null;
    }

    async function getClassPermissionForStudent(userId, userData, levelDB) {
        try {
            if (!userData || !userData.atrelado_professor) {
                return {
                    hasTeacher: false,
                    foundClass: false,
                    levelLimit: null
                };
            }

            const snapTurmas = await database
                .ref("usuarios/" + userData.atrelado_professor + "/turmas")
                .once("value");

            const turmas = snapTurmas.val() || {};
            let turmaDoAluno = null;

            for (const turmaId in turmas) {
                const studentRecord = turmas[turmaId]?.students?.[userId];

                if (studentRecord) {
                    turmaDoAluno = turmas[turmaId];
                    break;
                }
            }

            if (!turmaDoAluno) {
                return {
                    hasTeacher: true,
                    foundClass: false,
                    levelLimit: null
                };
            }

            const limits = turmaDoAluno.class_access?.limits || {};
            const levelLimit = getLevelLimitFromClassAccess(limits, levelDB);

            return {
                hasTeacher: true,
                foundClass: true,
                levelLimit: levelLimit
            };
        } catch (error) {
            console.error("Erro ao carregar permissões da turma:", error);
            return {
                hasTeacher: true,
                foundClass: false,
                levelLimit: null,
                error: error
            };
        }
    }

    function getPossiblePhaseKeysForActivity(activityId) {
        const keys = [];
        const localId = Number(activityId);
        const currentUnitNumber = getUnitNumber(currentUnit);
        const levelStart = getLevelStartNumber(currentLevel);

        if (!Number.isFinite(localId)) return keys;

        // Formato local usado especialmente no Level0 e em alguns históricos
        keys.push(`fase${localId}`);

        if (currentLevel === "Level0") {
            return [...new Set(keys)];
        }

        // Padrão atual usado pelo painel do professor e pelas páginas principais: blocos de 30 por unidade
        if (currentUnitNumber) {
            const phaseNumBy30 = levelStart + ((currentUnitNumber - 1) * 30) + (localId - 1);
            keys.push(`fase${phaseNumBy30}`);

            // Compatibilidade com registros antigos que possam ter usado 37 fases por unidade
            const phaseNumBy37 = levelStart + ((currentUnitNumber - 1) * 37) + (localId - 1);
            keys.push(`fase${phaseNumBy37}`);
        }

        return [...new Set(keys)];
    }

    function isTruthyProgressValue(value) {
        return value === true || value === 1 || value === "true" || value === "True";
    }

    function isActivityCompletedInProgress(progress, activityId) {
        if (!progress || typeof progress !== "object") return false;

        const possibleKeys = getPossiblePhaseKeysForActivity(activityId);

        for (const key of possibleKeys) {
            if (isTruthyProgressValue(progress[key])) {
                return true;
            }
        }

        return false;
    }

    function applyIndividualProgressToActivities(progress) {
        let firstLockedIndexFound = false;
        let lastPlayableIndex = -1;

        activities.forEach(activity => {
            activity.unlocked = false;
            activity.completed = false;
            activity.classAllowed = true;
            activity.blockedByTeacher = false;
        });

        for (let index = 0; index < activities.length; index++) {
            const activity = activities[index];
            const completed = isActivityCompletedInProgress(progress, activity.id);

            activity.completed = completed;

            if (completed) {
                activity.unlocked = true;
                lastPlayableIndex = index;
                continue;
            }

            if (!firstLockedIndexFound) {
                // Libera a próxima fase jogável depois da sequência concluída.
                activity.unlocked = true;
                lastPlayableIndex = index;
                firstLockedIndexFound = true;
            } else {
                activity.unlocked = false;
            }
        }

        lastUnlockedIndex = lastPlayableIndex;

        activities.forEach(activity => {
            console.log(`Fase ${activity.id} - completed? ${!!activity.completed} / unlocked by progress? ${!!activity.unlocked}`);
        });
    }

    function isAllowedByClassLimit(activityId, levelLimit) {
        if (!levelLimit) return false;

        const currentUnitNumber = getUnitNumber(currentUnit);
        const limitUnitNumber = getUnitNumber(levelLimit.unit);

        if (!currentUnitNumber || !limitUnitNumber) return false;

        // Unidade atual depois da unidade limite: bloqueia tudo
        if (currentUnitNumber > limitUnitNumber) {
            return false;
        }

        // Unidade atual antes da unidade limite: a turma permite todas as fases da unidade atual
        if (currentUnitNumber < limitUnitNumber) {
            return true;
        }

        // Unidade atual é a unidade limite: libera somente até a fase limite
        const phaseLimit = Number(levelLimit.phaseNumber || 0);
        return Number(activityId) <= phaseLimit;
    }

    function applyClassLimitToActivities(levelLimit) {
        currentClassLevelLimit = levelLimit || null;
        classLimitActiveForStudent = true;

        const currentUnitNumber = getUnitNumber(currentUnit);
        const limitUnitNumber = getUnitNumber(levelLimit?.unit);

        if (!levelLimit || !currentUnitNumber || !limitUnitNumber) {
            activities.forEach(activity => {
                activity.unlocked = false;
                activity.classAllowed = false;
                activity.blockedByTeacher = true;
            });
            lastUnlockedIndex = -1;
            setPermissionMessage("Your teacher has not released these phases yet.");
            return;
        }

        if (currentUnitNumber > limitUnitNumber) {
            activities.forEach(activity => {
                activity.unlocked = false;
                activity.classAllowed = false;
                activity.blockedByTeacher = true;
            });
            lastUnlockedIndex = -1;
            setPermissionMessage("Your teacher has not released this unit yet.");
            return;
        }

        let lastAllowedIndex = -1;
        let teacherBlockedNextPhase = false;

        activities.forEach((activity, index) => {
            const wasUnlockedByProgress = !!activity.unlocked;
            const classAllows = isAllowedByClassLimit(activity.id, levelLimit);

            activity.classAllowed = classAllows;
            activity.blockedByTeacher = !classAllows;

            if (wasUnlockedByProgress && !classAllows) {
                teacherBlockedNextPhase = true;
            }

            activity.unlocked = wasUnlockedByProgress && classAllows;

            if (activity.unlocked) {
                lastAllowedIndex = index;
            }

            console.log(`Fase ${activity.id} - progress allows? ${wasUnlockedByProgress} / class allows? ${classAllows} / final unlocked? ${!!activity.unlocked}`);
        });

        lastUnlockedIndex = lastAllowedIndex;

        if (lastUnlockedIndex < 0) {
            setPermissionMessage("Your teacher has not released these phases yet.");
        } else if (teacherBlockedNextPhase) {
            setPermissionMessage("Your teacher has not released the next phase yet. Please wait for your teacher.");
        } else {
            setPermissionMessage("");
        }
    }

    function canOpenActivity(activity) {
        if (!activity) return false;

        if (classLimitActiveForStudent && currentClassLevelLimit) {
            const classAllowsNow = isAllowedByClassLimit(activity.id, currentClassLevelLimit);

            if (!classAllowsNow) {
                activity.classAllowed = false;
                activity.blockedByTeacher = true;
                return false;
            }
        }

        return !!activity.unlocked;
    }

    // 7️⃣ Caso de usuário autenticado ou não:
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            const userId = user.uid;

            database.ref('/usuarios/' + userId).once('value')
                .then(snapshot => {
                    const userData = snapshot.val() || {};
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
                    loadUserProgress(userId, userAvatar, userData.role, userData);
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
    function loadUserProgress(userId, userAvatar, userRole, userData = {}) {
        const progressPath = `/usuarios/${userId}/progresso/${currentLevel}/${currentUnit}`;
        console.log(`Buscando progresso em: ${progressPath}`);

        setPermissionMessage("");
        lastUnlockedIndex = -1;
        classLimitActiveForStudent = false;
        currentClassLevelLimit = null;

        if (userRole === 'proprietario' || userRole === 'professor') {
            activities.forEach(activity => {
                activity.unlocked = true;
                activity.completed = true;
                activity.classAllowed = true;
                activity.blockedByTeacher = false;
            });
            lastUnlockedIndex = activities.length - 1;
            initializeMap(userAvatar);
        } else {
            database.ref(progressPath).once('value')
                .then(async snapshot => {
                    const progress = snapshot.val() || {};
                    console.log("Progresso encontrado:", progress);

                    applyIndividualProgressToActivities(progress);

                    if (userRole === 'aluno' && userData && userData.atrelado_professor) {
                        const classPermission = await getClassPermissionForStudent(userId, userData, currentLevel);

                        if (classPermission.foundClass && classPermission.levelLimit) {
                            applyClassLimitToActivities(classPermission.levelLimit);
                        } else {
                            classLimitActiveForStudent = true;
                            currentClassLevelLimit = null;
                            activities.forEach(activity => {
                                activity.unlocked = false;
                                activity.classAllowed = false;
                                activity.blockedByTeacher = true;
                            });
                            lastUnlockedIndex = -1;
                            setPermissionMessage("Your teacher has not released these phases yet.");
                        }
                    }

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

            const allowedAtRender = canOpenActivity(activity);

            // Imagem da fase
            const phaseImage = document.createElement('img');
            phaseImage.src = activity.img;
            phaseImage.alt = activity.name;
            phaseImage.classList.add('phase-img');
            phaseDiv.appendChild(phaseImage);

            // Estado (bloqueada ou ativa)
            if (allowedAtRender) {
                phaseDiv.classList.add('active');
            } else {
                phaseDiv.classList.add('locked');
                const lockIcon = document.createElement('img');
                lockIcon.src = '../../imagens/lock_icon_resized.png';
                lockIcon.classList.add('lock-icon');
                phaseDiv.appendChild(lockIcon);
            }

            // Clique com dupla proteção: progresso + limite da turma
            phaseDiv.addEventListener('click', () => {
                if (canOpenActivity(activity)) {
                    moveToPhase(index, activity.path);
                } else if (activity.blockedByTeacher) {
                    setPermissionMessage("Your teacher has not released this phase yet. Please wait for your teacher.");
                }
            });

            mapContainer.appendChild(phaseDiv);
        });

        // Recalcula lastUnlockedIndex a partir do estado final renderizado
        lastUnlockedIndex = -1;
        activities.forEach((activity, index) => {
            if (canOpenActivity(activity)) {
                lastUnlockedIndex = index;
            }
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
        if (!phaseDiv) return;

        const unlockGif = document.createElement('img');
        unlockGif.src = '../../imagens/cadeado.gif';
        unlockGif.classList.add('unlock-gif');
        phaseDiv.appendChild(unlockGif);

        const unlockSound = new Audio('../../imagens/unlock-padlock.mp3');
        unlockSound.play().catch(error => {
            console.warn("Não foi possível tocar o som de desbloqueio:", error);
        });

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