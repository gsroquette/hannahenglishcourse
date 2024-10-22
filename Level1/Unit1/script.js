document.addEventListener('DOMContentLoaded', function() {
    const database = firebase.database();
    const auth = firebase.auth();

    const activities = [
        { id: 1, name: "StoryCards", path: "../Unit1/StoryCards/index.html?fase=1", img: "../../imagens/botoes/storycards_button.png", unlocked: false },
        { id: 2, name: "Flashcards", path: "../Unit1/Flashcards/index.html?fase=2", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 3, name: "Flashcards2", path: "../Unit1/Flashcards2/index.html?fase=3", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 4, name: "Flashcards3", path: "../Unit1/Flashcards3/index.html?fase=4", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 5, name: "QUIZ", path: "../Unit1/QUIZ/index.html?fase=5", img: "../../imagens/botoes/quiz_button.png", unlocked: false }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let player;
    let lastUnlockedIndex = -1;

    const loginLink = document.getElementById("loginLink");
    const userDropdown = document.getElementById("userDropdown");

    // Verificar o estado de autenticação após carregar o DOM
    auth.onAuthStateChanged(function(user) {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            atualizarQuadroBranco(user);
        } else {
            console.log("Usuário não autenticado.");
            exibirLinkDeLogin();
        }
    });

    // Função para atualizar o quadro branco com as informações do usuário
    function atualizarQuadroBranco(user) {
        const userRef = database.ref('usuarios/' + user.uid);
        userRef.once('value')
            .then((snapshot) => {
                const userData = snapshot.val();

                if (!userData) {
                    console.error("Dados do usuário não encontrados no banco de dados.");
                    exibirLinkDeLogin(); // Mostra o link de login
                    return;
                }

                const userName = userData.nome || user.email;
                const userAvatar = userData.avatar ? `imagens/${userData.avatar}` : 'imagens/bonecologin1.png';

                // Atualiza o quadro branco de login
                loginLink.innerHTML = `<img src="${userAvatar}" alt="User Icon" class="user-icon"><p class="user-name">${userName}</p>`;
                loginLink.removeAttribute('href'); // Remove o link de login

                // Define o dashboard conforme o tipo de usuário
                let dashboardLink = '';
                if (userData.role === 'proprietario') {
                    dashboardLink = '<a href="painel_proprietario.html" class="dashboard-link">OWNER DASHBOARD</a>';
                } else if (userData.role === 'professor') {
                    dashboardLink = '<a href="painel_professor.html" class="dashboard-link">TEACHER DASHBOARD</a>';
                } else if (userData.role === 'aluno') {
                    dashboardLink = '<a href="painel_aluno.html" class="dashboard-link">STUDENT DASHBOARD</a>';
                }

                // Atualiza o dropdown com o link do dashboard e botão de logout
                userDropdown.innerHTML = `${dashboardLink}<a href="#" id="logout">LEAVE</a>`;
                userDropdown.style.display = 'none'; // Inicialmente escondido

                console.log("Quadro branco atualizado com o usuário:", userName);
            })
            .catch((error) => {
                console.error("Erro ao acessar os dados do usuário:", error.message);
                exibirLinkDeLogin();
            });
    }

    // Função para exibir o link de login
    function exibirLinkDeLogin() {
        loginLink.innerHTML = 'Login';
        loginLink.setAttribute('href', 'Formulario/login.html');
    }

    // Alternar dropdown ao clicar
    document.getElementById("loginContainer").addEventListener("click", function(event) {
        const user = auth.currentUser;
        if (!user) return;

        event.preventDefault();
        const dropdown = document.getElementById("userDropdown");
        dropdown.style.display = (dropdown.style.display === 'none' || dropdown.style.display === '') ? 'block' : 'none';
    });

    // Fecha o dropdown ao clicar fora dele
    window.addEventListener("click", function(event) {
        const dropdown = document.getElementById("userDropdown");
        const loginContainer = document.getElementById("loginContainer");
        if (!loginContainer.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Função para deslogar
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

    // Função para carregar o progresso do usuário
    function loadUserProgress(userId) {
        console.log("Carregando progresso do usuário:", userId);

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
                        if (progress[`fase${activity.id}`] === true) {
                            activity.unlocked = true;
                            lastUnlockedIndex = index; // Atualiza a última fase desbloqueada
                        } else {
                            activity.unlocked = false;
                        }
                    });
                } else {
                    console.error("Nenhum progresso encontrado para este nível e unidade.");
                }

                initializeMap();

                database.ref(avatarPath).once('value').then((avatarSnapshot) => {
                    const avatarFileName = avatarSnapshot.val();
                    const avatarImgPath = avatarFileName ? `../../imagens/${avatarFileName}` : '../../imagens/bonequinho.png';
                    createPlayer(avatarImgPath); // Cria o jogador com o avatar do usuário
                }).catch(() => {
                    createPlayer(); // Usa o avatar padrão em caso de erro
                });
            })
            .catch((error) => {
                console.error("Erro ao carregar o progresso do usuário:", error);
                initializeMap();
                createPlayer(); // Cria o jogador com o avatar padrão em caso de erro
            });
    }

    // Função para criar o jogador no mapa
    function createPlayer(avatarPath = '../../imagens/bonequinho.png', startAtFirstPhase = false) {
        player = document.createElement('img');
        player.src = avatarPath;
        player.classList.add('player');
        mapContainer.appendChild(player);

        // Determina a fase inicial
        const initialPhaseIndex = startAtFirstPhase ? 0 : (lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0);
        moveToPhase(initialPhaseIndex);
    }

    // Função para inicializar o mapa
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

        if (lastUnlockedIndex >= 0) {
            const lastUnlockedPhase = document.querySelectorAll('.phase')[lastUnlockedIndex];
            animateUnlock(lastUnlockedPhase);

            scrollToPhase(lastUnlockedIndex);
        }
    }

    // Função para mover o jogador para a fase
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

    // Função para desenhar linhas entre fases
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
});
