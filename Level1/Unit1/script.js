<!-- HTML para o quadro branco -->
<div class="login-container" id="loginContainer">
    <a href="Formulario/login.html" class="login-button" id="loginLink">Login</a>
    <div class="dropdown" id="userDropdown"></div>
</div>

<style>
/* CSS para o quadro branco */
/* Estilo da caixa de login */
.login-container {
    display: flex;
    align-items: center; /* Alinha verticalmente */
    gap: 10px; /* Espaço entre avatar e nome */
    position: absolute;
    top: 20px;
    right: 60px;
    z-index: 10;
    background-color: white;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    cursor: pointer;
}

.user-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
}

.user-name {
    font-size: 14px;
    color: #333;
    margin: 0;
}

.dropdown {
    display: none;
    position: absolute;
    top: 60px;
    right: 0;
    background-color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    z-index: 1;
    border-radius: 4px;
    min-width: 150px;
}

.dropdown a {
    display: block;
    padding: 10px;
    text-decoration: none;
    color: #333;
    font-size: 16px;
    text-align: left;
}

.dropdown a:hover {
    background-color: #f2f2f2;
}
</style>

<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>

<script>
// Firebase Configuração
var firebaseConfig = {
    apiKey: "AIzaSyDGgo2H_hDKXF88xN7XnLFNUj8ikMY7Xdc",
    authDomain: "hannahenglishcourse.firebaseapp.com",
    databaseURL: "https://hannahenglishcourse-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hannahenglishcourse",
    storageBucket: "hannahenglishcourse.appspot.com",
    messagingSenderId: "449818788486",
    appId: "1:449818788486:web:8a49d3f68591e6fb3f0707",
    measurementId: "G-07VVJG9LRS"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

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
            updateLoginContainer(userId); // Atualiza o quadro branco com o usuário logado

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
        } else {
            console.error("Usuário não autenticado!");
        }
    });

    function updateLoginContainer(userId) {
        const loginLink = document.getElementById("loginLink");
        const userDropdown = document.getElementById("userDropdown");

        const userRef = firebase.database().ref('usuarios/' + userId);
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

            userDropdown.innerHTML = `${dashboardLink}<a href="#" id="logout">LEAVE</a>`;

            document.querySelectorAll('.dashboard-link').forEach(link => {
                link.addEventListener('click', function(event) {
                    event.preventDefault();
                    window.location.href = this.getAttribute('href');
                });
            });
        });
    }

    // Funções de carregamento e controle das atividades permanecem as mesmas...

    // Alternar o dropdown ao clicar
    document.getElementById("loginContainer").addEventListener("click", function(event) {
        const user = firebase.auth().currentUser;
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
            firebase.auth().signOut().then(() => {
                console.log("Usuário deslogado");
                location.reload();
            }).catch((error) => {
                console.error("Erro ao deslogar:", error);
            });
        }
    });
});
</script>
