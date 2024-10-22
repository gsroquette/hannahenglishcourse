
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

    // Configuração inicial de autenticação e desbloqueio de fases
    auth.onAuthStateChanged(user => {
        if (user) {
            const userId = user.uid;
            database.ref('/usuarios/' + userId).once('value').then(snapshot => {
                const userData = snapshot.val();
                // Configuração da interface e desbloqueio de fases
                if (userData.role === 'proprietario' || userData.role === 'professor') {
                    activities.forEach(activity => activity.unlocked = true);
                    lastUnlockedIndex = activities.length - 1;
                    initializeMap();
                    createPlayer(userData.avatar || '../../imagens/bonequinho.png', true);
                } else if (userData.role === 'aluno') {
                    loadUserProgress(userId);
                }
            });
        }
    });

    function initializeMap() {
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
        });
    }

    function createPlayer(avatarPath, startAtFirstPhase) {
        player = document.createElement('img');
        player.src = avatarPath;
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(startAtFirstPhase ? 0 : lastUnlockedIndex);
    }

    function moveToPhase(index) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
    }
});
