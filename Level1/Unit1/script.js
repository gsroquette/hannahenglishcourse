document.addEventListener('DOMContentLoaded', function() {
    const database = firebase.database();
    const auth = firebase.auth();

    function updateLoginContainer(userId) {
        const loginLink = document.getElementById("loginLink");
        const userDropdown = document.getElementById("userDropdown");

        database.ref('usuarios/' + userId).once('value').then((snapshot) => {
            const userData = snapshot.val();
            const userName = userData.nome || user.email;
            const userAvatar = userData.avatar ? `imagens/${userData.avatar}` : 'imagens/bonecologin1.png';

            loginLink.innerHTML = `<img src="${userAvatar}" alt="User Icon" class="user-icon"><p class="user-name">${userName}</p>`;
            loginLink.removeAttribute('href');

            let dashboardLink = '';
            if (userData.role === 'proprietario') {
                dashboardLink = '<a href="painel_proprietario.html" class="dashboard-link">OWNER DASHBOARD</a>';
            } else if (userData.role === 'professor') {
                dashboardLink = '<a href="painel_professor.html" class="dashboard-link">TEACHER DASHBOARD</a>';
            } else if (userData.role === 'aluno') {
                dashboardLink = '<a href="painel_aluno.html" class="dashboard-link">STUDENT DASHBOARD</a>';
            }

            userDropdown.innerHTML = `${dashboardLink}<a href="#" id="logout">LEAVE</a>`;
        });
    }

    const activities = [
        { id: 1, name: "StoryCards", path: "../Unit1/StoryCards/index.html?fase=1", img: "../../imagens/botoes/storycards_button.png", unlocked: false },
        { id: 2, name: "Flashcards", path: "../Unit1/Flashcards/index.html?fase=2", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 3, name: "Flashcards2", path: "../Unit1/Flashcards2/index.html?fase=3", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 4, name: "Flashcards3", path: "../Unit1/Flashcards3/index.html?fase=4", img: "../../imagens/botoes/flashcards_button.png", unlocked: false },
        { id: 5, name: "QUIZ", path: "../Unit1/QUIZ/index.html?fase=5", img: "../../imagens/botoes/quiz_button.png", unlocked: false }
    ];

    const mapContainer = document.getElementById('mapContainer');
    let player;
    let lastUnlockedIndex = -1;

    auth.onAuthStateChanged(user => {
        if (user) {
            const userId = user.uid;
            console.log(`Usuário autenticado: ${userId}`);
            updateLoginContainer(userId);

            // Verifica o role do usuário
            database.ref(`/usuarios/${userId}/role`).once('value').then((snapshot) => {
                const role = snapshot.val();
                if (role === 'professor' || role === 'proprietario') {
                    activities.forEach(activity => activity.unlocked = true);
                    lastUnlockedIndex = activities.length - 1;
                    initializeMap();

                    const avatarPath = `/usuarios/${userId}/avatar`;
                    database.ref(avatarPath).once('value').then((avatarSnapshot) => {
                        const avatarFileName = avatarSnapshot.val();
                        const avatarImgPath = avatarFileName ? `../../imagens/${avatarFileName}` : '../../imagens/bonequinho.png';
                        createPlayer(avatarImgPath, true);
                    }).catch(() => {
                        createPlayer('../../imagens/bonequinho.png', true);
                    });
                } else if (role === 'aluno') {
                    loadUserProgress(userId);
                }
            });
        }
    });

    function loadUserProgress(userId) {
        const urlPathParts = window.location.pathname.split('/');
        const level = urlPathParts[urlPathParts.length - 3];
        const unit = urlPathParts[urlPathParts.length - 2];

        const progressPath = `/usuarios/${userId}/progresso/${level}/${unit}`;
        const avatarPath = `/usuarios/${userId}/avatar`;

        database.ref(progressPath).once('value').then((snapshot) => {
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
            }
            initializeMap();

            database.ref(avatarPath).once('value').then((avatarSnapshot) => {
                const avatarFileName = avatarSnapshot.val();
                const avatarImgPath = avatarFileName ? `../../imagens/${avatarFileName}` : '../../imagens/bonequinho.png';
                createPlayer(avatarImgPath);
            }).catch(() => {
                createPlayer();
            });
        });
    }

    function createPlayer(avatarPath = '../../imagens/bonequinho.png', startAtFirstPhase = false) {
        player = document.createElement('img');
        player.src = avatarPath;
        player.classList.add('player');
        mapContainer.appendChild(player);

        const initialPhaseIndex = startAtFirstPhase ? 0 : (lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0);
        moveToPhase(initialPhaseIndex);
    }

    function initializeMap() {
        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');
            phaseDiv.style.top = `${200 + index * 20}%`;
            phaseDiv.style.left = index % 2 === 0 ? '10%' : '85%';

            const phaseImage = document.createElement('img');
            phaseImage.src = activity.img;
            phaseImage.alt = activity.name;
            phaseImage.classList.add('phase-img');
            phaseDiv.appendChild(phaseImage);

            if (activity.unlocked) {
                phaseDiv.classList.add('active');
            } else {
                phaseDiv.classList.add('locked');
                const lockIcon = document.createElement('img');
                lockIcon.src = '../../imagens/lock_icon_resized.png';
                lockIcon.classList.add('lock-icon');
                phaseDiv.appendChild(lockIcon);
            }

            mapContainer.appendChild(phaseDiv);
            phaseDiv.addEventListener('click', () => {
                if (activity.unlocked) moveToPhase(index, activity.path);
            });
        });
    }

    function moveToPhase(index, path = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;

        if (path) setTimeout(() => window.location.href = path, 600);
    }
});
