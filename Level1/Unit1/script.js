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

    auth.onAuthStateChanged(user => {
        if (user) {
            const userId = user.uid;
            console.log(`Usuário autenticado: ${userId}`);
            checkUserRole(userId); // Verifica o papel do usuário
        } else {
            console.error("Usuário não autenticado!");
        }
    });

    // Função para verificar o papel do usuário
    function checkUserRole(userId) {
        const userRoleRef = database.ref(`usuarios/${userId}/role`);
        userRoleRef.once('value').then(snapshot => {
            const role = snapshot.val();
            if (role === 'professor' || role === 'proprietario') {
                unlockAllPhases(); // Libera todas as fases
            } else {
                loadUserProgress(userId); // Carrega progresso normal do usuário
            }
        }).catch(error => {
            console.error("Erro ao verificar o papel do usuário:", error);
        });
    }

    // Função para liberar todas as fases
    function unlockAllPhases() {
        activities.forEach(activity => {
            activity.unlocked = true;
        });
        lastUnlockedIndex = activities.length - 1;
        initializeMap(); // Inicializa o mapa com todas as fases desbloqueadas
        createPlayer(); // Cria o bonequinho
    }

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

    // ... [restante do código permanece inalterado]
});
