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

    // Inicializa o Firebase e o quadro branco de login
    auth.onAuthStateChanged(function(user) {
        const loginLink = document.getElementById("loginLink");
        const userDropdown = document.getElementById("userDropdown");

        if (user) {
            const userRef = database.ref('usuarios/' + user.uid);
            userRef.once('value').then((snapshot) => {
                const userData = snapshot.val();
                const userName = userData.nome || user.email;
                const userAvatar = userData.avatar ? `imagens/${userData.avatar}` : 'imagens/bonecologin1.png';

                // Atualiza o quadro branco de login
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
        } else {
            loginLink.setAttribute('href', 'Formulario/login.html');
        }
    });

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
                console.error("Erro ao deslogar:", error);
            });
        }
    });

    // Funções existentes (loadUserProgress, createPlayer, etc.) permanecem inalteradas
    function loadUserProgress(userId) { /* Código original permanece */ }
    function createPlayer(avatarPath = '../../imagens/bonequinho.png', startAtFirstPhase = false) { /* Código original permanece */ }
    function initializeMap() { /* Código original permanece */ }
    function moveToPhase(index, path = null) { /* Código original permanece */ }
    function scrollToPhase(index) { /* Código original permanece */ }
    function drawLines() {
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
