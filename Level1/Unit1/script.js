
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
        } else {
            loginLink.setAttribute('href', 'Formulario/login.html');
        }
    });

    // Restante do código JS existente
    // ... (código original é mantido aqui)
});
