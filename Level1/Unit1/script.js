<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hannah English - Learning English with the Bible</title>
    <link rel="stylesheet" href="CSS/styles.css">
    <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>
    <style>
        /* Adicione seu estilo aqui */
    </style>
</head>
<body>
    <div id="loginContainer">
        <a id="loginLink" href="Formulario/login.html">Login</a>
        <div class="dropdown" id="userDropdown"></div>
    </div>
    <div id="mapContainer"></div>
    <svg id="linesSvg"></svg>

    <script>
        const database = firebase.database();
        const auth = firebase.auth();

        // Configurar persistência
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => console.log("Persistência de autenticação definida para LOCAL."))
            .catch(error => console.error("Erro ao definir a persistência:", error.message));

        const activities = [
            { id: 1, name: "StoryCards", path: "../Unit1/StoryCards/index.html?fase=1", img: "../../imagens/botoes/storycards_button.png", unlocked: false },
            { id: 2, name: "Flashcards", path: "../Unit1/Flashcards/index.html?fase=2", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
            { id: 3, name: "Flashcards2", path: "../Unit1/Flashcards2/index.html?fase=3", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
            { id: 4, name: "Flashcards3", path: "../Unit1/Flashcards3/index.html?fase=4", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
            { id: 5, name: "QUIZ", path: "../Unit1/QUIZ/index.html?fase=5", img: "../../imagens/botoes/quiz_button.png", unlocked: false }
        ];

        let player;
        let lastUnlockedIndex = -1;

        // Verificar autenticação
        auth.onAuthStateChanged(function(user) {
            if (user) {
                console.log("Usuário autenticado:", user.uid);
                atualizarQuadroBranco(user);
            } else {
                console.log("Usuário não autenticado.");
                exibirLinkDeLogin();
            }
        });

        // Atualiza o quadro branco
        function atualizarQuadroBranco(user) {
            const userRef = database.ref('usuarios/' + user.uid);
            userRef.once('value')
                .then((snapshot) => {
                    const userData = snapshot.val();
                    console.log("Dados do usuário recebidos:", userData);

                    if (!userData) {
                        console.error("Dados do usuário não encontrados no banco de dados.");
                        exibirLinkDeLogin();
                        return;
                    }

                    const userName = userData.nome || user.email;
                    const userAvatar = userData.avatar ? `imagens/${userData.avatar}` : 'imagens/bonecologin1.png';

                    // Atualiza o quadro branco
                    loginLink.innerHTML = `<img src="${userAvatar}" alt="User Icon" class="user-icon"><p class="user-name">${userName}</p>`;
                    loginLink.removeAttribute('href'); 
                    userDropdown.style.display = 'block';

                    // Define o dashboard
                    let dashboardLink = '';
                    if (userData.role === 'proprietario') {
                        dashboardLink = '<a href="painel_proprietario.html" class="dashboard-link">OWNER DASHBOARD</a>';
                    } else if (userData.role === 'professor') {
                        dashboardLink = '<a href="painel_professor.html" class="dashboard-link">TEACHER DASHBOARD</a>';
                    } else if (userData.role === 'aluno') {
                        dashboardLink = '<a href="painel_aluno.html" class="dashboard-link">STUDENT DASHBOARD</a>';
                    }

                    userDropdown.innerHTML = `${dashboardLink}<a href="#" id="logout">LEAVE</a>`;
                    console.log("Quadro branco atualizado com o usuário:", userName);
                })
                .catch((error) => {
                    console.error("Erro ao acessar os dados do usuário:", error.message);
                    exibirLinkDeLogin();
                });
        }

        // Exibir link de login
        function exibirLinkDeLogin() {
            loginLink.innerHTML = 'Login';
            loginLink.setAttribute('href', 'Formulario/login.html');
            userDropdown.style.display = 'none';
        }

        // Alternar dropdown ao clicar
        document.getElementById("loginContainer").addEventListener("click", function(event) {
            const user = auth.currentUser;
            if (!user) return;

            event.preventDefault();
            const dropdown = document.getElementById("userDropdown");
            dropdown.style.display = (dropdown.style.display === 'none' || dropdown.style.display === '') ? 'block' : 'none';
            console.log("Dropdown exibido:", dropdown.style.display);
        });

        // Fecha o dropdown ao clicar fora dele
        window.addEventListener("click", function(event) {
            const dropdown = document.getElementById("userDropdown");
            const loginContainer = document.getElementById("loginContainer");
            if (!loginContainer.contains(event.target)) {
                dropdown.style.display = 'none';
                console.log("Dropdown oculto.");
            }
        });

        // Logout
        document.addEventListener("click", function(event) {
            if (event.target.id === "logout") {
                auth.signOut().then(() => {
                    console.log("Usuário deslogado");
                    location.reload();
                }).catch((error) => {
                    console.error("Erro ao deslogar:", error.message);
                });
            }
        });

        // Carregar progresso do usuário
        function loadUserProgress(userId) {
            console.log("Carregando progresso do usuário:", userId);
            const urlPathParts = window.location.pathname.split('/');
            const level = urlPathParts[urlPathParts.length - 3];
            const unit = urlPathParts[urlPathParts.length - 2];

            const progressPath = `/usuarios/${userId}/progresso/${level}/${unit}`;
            database.ref(progressPath).once('value')
                .then((snapshot) => {
                    const progress = snapshot.val();
                    if (progress) {
                        activities.forEach((activity, index) => {
                            if (progress[`fase${activity.id}`] === true) {
                                activity.unlocked = true;
                                lastUnlockedIndex = index;
                            } else {
                                activity.unlocked = false;
                            }
                        });
                    } else {
                        console.error("Nenhum progresso encontrado para este nível e unidade.");
                    }

                    initializeMap();
                })
                .catch((error) => {
                    console.error("Erro ao carregar o progresso do usuário:", error);
                    initializeMap();
                });
        }

        // Criar jogador no mapa
        function createPlayer(avatarPath = '../../imagens/bonequinho.png', startAtFirstPhase = false) {
            player = document.createElement('img');
            player.src = avatarPath;
            player.classList.add('player');
            mapContainer.appendChild(player);

            const initialPhaseIndex = startAtFirstPhase ? 0 : (lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0);
            moveToPhase(initialPhaseIndex);
        }

        // Inicializar mapa
        function initializeMap() {
            console.log("Inicializando mapa...");
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
                    phaseDiv.appendChild(lockIcon);
                }

                phaseDiv.addEventListener('click', () => {
                    if (activity.unlocked) {
                        moveToPhase(index, activity.path);
                    }
                });
            });

            drawLines();

            if (lastUnlockedIndex >= 0) {
                const lastUnlockedPhase = document.querySelectorAll('.phase')[lastUnlockedIndex];
                animateUnlock(lastUnlockedPhase);
                scrollToPhase(lastUnlockedIndex);
            }
        }

        // Rolar jogador para a fase
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

        // Desenhar linhas entre fases
        function drawLines() {
            console.log("Desenhando linhas entre fases...");
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

        // Animar desbloqueio
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

        // Rolar para a fase
        function scrollToPhase(index) {
            const phase = document.querySelectorAll('.phase')[index];
            const coords = phase.getBoundingClientRect();
            window.scrollTo({
                top: coords.top + window.scrollY - window.innerHeight / 2,
                behavior: 'smooth'
            });
        }
    </script>
</body>
</html>
