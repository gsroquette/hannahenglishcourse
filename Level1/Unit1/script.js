
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
            user.getIdTokenResult().then((idTokenResult) => {
                const userRole = idTokenResult.claims.role || ''; // Garante que não seja undefined

                // Verifica se o role é "proprietario" ou "professor"
                if (userRole.toLowerCase() === 'proprietario' || userRole.toLowerCase() === 'professor') {
                    activities.forEach(activity => {
                        activity.unlocked = true; // Libera todas as fases
                    });
                    lastUnlockedIndex = activities.length - 1; // Define última fase como desbloqueada
                    initializeMap(); // Inicializa o mapa
                    createPlayer(); // Cria o jogador
                } else {
                    loadUserProgress(userId); // Carrega o progresso normal do usuário
                }
            }).catch((error) => {
                console.error("Erro ao obter o token do usuário:", error);
                loadUserProgress(userId); // Carrega o progresso normal do usuário em caso de erro
            });
        } else {
            console.error("Usuário não autenticado!");
        }
    });

    // Restante do código permanece o mesmo (sem alterações)
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

                database.ref(avatarPath).once('value').then((avatarSnapshot) => {
                    const avatarFileName = avatarSnapshot.val();
                    const avatarImgPath = `../../imagens/${avatarFileName}`;
                    createPlayer(avatarImgPath);
                }).catch(() => {
                    createPlayer();
                });
            })
            .catch((error) => {
                console.error("Erro ao carregar o progresso do usuário:", error);
                initializeMap();
                createPlayer();
            });
    }
    
    // As funções createPlayer(), initializeMap(), e outras continuam inalteradas.
});

