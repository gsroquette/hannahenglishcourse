function loadUserProgress() {
    const urlPathParts = window.location.pathname.split('/');
    const level = urlPathParts[urlPathParts.length - 3];
    const unit = urlPathParts[urlPathParts.length - 2];
    const userId = "SUNqNVmtcrh1YdZgjaRDAu3uAmj2"; // Atualize este ID para o usuário ativo

    // Definir o caminho para o progresso
    const progressPath = `/usuarios/${userId}/progresso/${level}/${unit}`;
    const avatarPath = `/usuarios/${userId}/avatar`;

    // Obter o progresso
    const progressRef = firebase.database().ref(progressPath);
    progressRef.once('value')
        .then((snapshot) => {
            const progress = snapshot.val();
            if (progress) {
                activities.forEach((activity, index) => {
                    if (progress[`fase${index + 1}`] === true) {
                        activity.unlocked = true;
                        currentPhase = index;
                    }
                });
            }
            initializeMap();

            // Obter o avatar do usuário
            const avatarRef = firebase.database().ref(avatarPath);
            avatarRef.once('value').then((avatarSnapshot) => {
                const avatarFileName = avatarSnapshot.val();
                const avatarImgPath = `../../imagens/${avatarFileName}.png`; // Certifique-se de que o caminho está correto

                createPlayer(avatarImgPath); // Passa o caminho do avatar
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
    moveToPhase(currentPhase);
}
