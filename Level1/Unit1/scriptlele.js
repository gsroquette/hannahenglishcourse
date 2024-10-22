
document.addEventListener('DOMContentLoaded', function() {
    const database = firebase.database();
    const auth = firebase.auth();

    // Função para gerenciar a caixa de login
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
                userDropdown.innerHTML = `
                    ${dashboardLink}
                    <a href="#" id="logout">LEAVE</a>
                `;

                // Adiciona funcionalidade de logout
                document.getElementById("logout").addEventListener("click", function() {
                    auth.signOut().then(() => {
                        console.log("Usuário deslogado");
                        location.reload();
                    }).catch(error => {
                        console.error("Erro ao deslogar:", error);
                    });
                });
            });

            // Chamando a função original para carregar o progresso e o mapa
            loadUserProgress(userId);
        } else {
            loginLink.setAttribute('href', 'Formulario/login.html');
            bloquearTodosNiveis(); // Bloqueia todos os níveis se não estiver autenticado
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
                        lastUnlockedIndex = index;  // Atualiza com o índice da última fase desbloqueada
                    } else {
                        activity.unlocked = false;  // Garante que a fase permaneça bloqueada se não estiver no progresso
                    }
                });
            } else {
                console.error("Nenhum progresso encontrado para este nível e unidade.");
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

    // Restante do código original para gerenciar o mapa e as fases
    // ...
});
