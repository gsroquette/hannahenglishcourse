
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

    // Função para gerenciar a caixa de login e desbloqueio das fases
    auth.onAuthStateChanged(user => {
        const loginLink = document.getElementById("loginLink");
        const userDropdown = document.getElementById("userDropdown");

        if (user) {
            const userId = user.uid;
            database.ref('/usuarios/' + userId).once('value').then(snapshot => {
                const userData = snapshot.val();
                const userName = userData.nome || user.email;
                const userAvatar = userData.avatar ? `../../imagens/${userData.avatar}` : '../../imagens/bonecologin1.png';

                // Atualiza a interface do usuário
                loginLink.innerHTML = `<img src="${userAvatar}" alt="User Icon" class="user-icon"><p class="user-name">${userName}</p>`;
                loginLink.removeAttribute('href');

                let dashboardLink = '';
                if (userData.role === 'proprietario' || userData.role === 'professor') {
                    dashboardLink = userData.role === 'proprietario' ? 
                                    '<a href="painel_proprietario.html" class="dashboard-link">OWNER DASHBOARD</a>' : 
                                    '<a href="painel_professor.html" class="dashboard-link">TEACHER DASHBOARD</a>';

                    activities.forEach(activity => activity.unlocked = true); // Desbloqueia todas as fases
                    lastUnlockedIndex = activities.length - 1; // Marca todas as fases como desbloqueadas
                    initializeMap(); // Inicializa o mapa

                    // Busca o avatar e cria o jogador
                    const avatarPath = `/usuarios/${userId}/avatar`;
                    database.ref(avatarPath).once('value').then((avatarSnapshot) => {
                        const avatarFileName = avatarSnapshot.val();
                        const avatarImgPath = avatarFileName ? `../../imagens/${avatarFileName}` : '../../imagens/bonequinho.png';
                        createPlayer(avatarImgPath, true); // Começa na primeira fase
                    }).catch(() => {
                        createPlayer('../../imagens/bonequinho.png', true); // Avatar padrão
                    });
                } else if (userData.role === 'aluno') {
                    dashboardLink = '<a href="painel_aluno.html" class="dashboard-link">STUDENT DASHBOARD</a>';
                    loadUserProgress(userId); // Carrega o progresso do aluno
                }

                userDropdown.innerHTML = `
                    ${dashboardLink}
                    <a href="#" id="logout">LEAVE</a>
                `;

                // Função de logout
                document.getElementById("logout").addEventListener("click", function() {
                    auth.signOut().then(() => {
                        console.log("Usuário deslogado");
                        location.reload();
                    }).catch(error => {
                        console.error("Erro ao deslogar:", error);
                    });
                });
            });
        } else {
            loginLink.setAttribute('href', 'Formulario/login.html');
            bloquearTodosNiveis(); // Bloqueia os níveis para usuários não autenticados
        }
    });

    function loadUserProgress(userId) {
        const urlPathParts = window.location.pathname.split('/');
        const level = urlPathParts[urlPathParts.length - 3];
        const unit = urlPathParts[urlPathParts.length - 2];

        const progressPath = `/usuarios/${userId}/progresso/${level}/${unit}`;
        const avatarPath = `/usuarios/${userId}/avatar`;

        database.ref(progressPath).once('value').then(snapshot => {
            const progress = snapshot.val();
            if (progress) {
                activities.forEach((activity, index) => {
                    if (progress[`fase${activity.id}`] === true) {
                        activity.unlocked = true;
                        lastUnlockedIndex = index;  // Atualiza com a última fase desbloqueada
                    }
                });
            }

            initializeMap();

            // Busca o avatar do usuário
            database.ref(avatarPath).once('value').then(avatarSnapshot => {
                const avatarFileName = avatarSnapshot.val();
                const avatarImgPath = avatarFileName ? `../../imagens/${avatarFileName}` : '../../imagens/bonequinho.png';
                createPlayer(avatarImgPath); // Posiciona o avatar na fase correta
            }).catch(() => {
                createPlayer(); // Usa o avatar padrão se houver erro
            });
        }).catch(error => {
            console.error("Erro ao carregar o progresso do usuário:", error);
            initializeMap();
            createPlayer(); // Garante que o bonequinho apareça
        });
    }

    function initializeMap() {
        window.scrollTo(0, 0); // Rola para o topo antes de desenhar as linhas

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
            scrollToPhase(lastUnlockedIndex); // Rola para a fase desbloqueada
        }
    }

    // Restante das funções originais para criar o jogador, mover fases, etc.
    // ...
});
