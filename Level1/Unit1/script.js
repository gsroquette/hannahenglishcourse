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
                } else {
                    console.error("Role não reconhecido!");
                }
            });

            updateUserInterface(user);

        } else {
            console.error("Usuário não autenticado!");
        }
    });

    function updateUserInterface(user) {
        const loginLink = document.getElementById("loginLink");
        const userDropdown = document.getElementById("userDropdown");

        if (user) {
            const userRef = firebase.database().ref('usuarios/' + user.uid);
            userRef.once('value').then((snapshot) => {
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

                userDropdown.innerHTML = `
                    ${dashboardLink}
                    <a href="#" id="logout">LEAVE</a>
                `;

                document.querySelectorAll('.dashboard-link').forEach(link => {
                    link.addEventListener('click', function(event) {
                        event.preventDefault();
                        window.location.href = this.getAttribute('href');
                    });
                });
            });
        }
    }

    document.getElementById("loginContainer").addEventListener("click", function(event) {
        const user = firebase.auth().currentUser;
        if (!user) return;

        event.preventDefault();
        const dropdown = document.getElementById("userDropdown");
        dropdown.style.display = (dropdown.style.display === 'none' || dropdown.style.display === '') ? 'block' : 'none';
    });

    window.addEventListener("click", function(event) {
        const dropdown = document.getElementById("userDropdown");
        const loginContainer = document.getElementById("loginContainer");
        if (!loginContainer.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener("click", function(event) {
        if (event.target.id === "logout") {
            firebase.auth().signOut().then(() => {
                console.log("Usuário deslogado");
                location.reload();
            }).catch((error) => {
                console.error("Erro ao deslogar:", error);
            });
        }
    });

    function loadUserProgress(userId) { /* ... código original ... */ }
    function createPlayer(avatarPath = '../../imagens/bonequinho.png', startAtFirstPhase = false) { /* ... código original ... */ }
    function initializeMap() { /* ... código original ... */ }
    function moveToPhase(index, path = null) { /* ... código original ... */ }
    function scrollToPhase(index) { /* ... código original ... */ }
    function drawLines() { /* ... código original ... */ }
});
