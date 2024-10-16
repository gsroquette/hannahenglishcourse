document.addEventListener('DOMContentLoaded', async function() { 
    // Garante que a rolagem da página esteja no topo
    window.scrollTo(0, 0);

    const activities = [
        { id: 1, name: "StoryCards", path: "../Unit4/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../Unit4/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "Flashcards2", path: "../Unit4/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 4, name: "Flashcards3", path: "../Unit4/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 5, name: "QUIZ", path: "../Unit4/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;
    let player;
    let positionLeft = true;

    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            await fetchUserProgress(user);
            initializePhases();

            // Força o navegador a renderizar todas as fases antes de desenhar as linhas
            renderAllPhases(() => {
                drawLines();
                createPlayer();
            });
        } else {
            console.error("Usuário não autenticado.");
        }
    });

    async function fetchUserProgress(user) {
        // Função existente de fetchUserProgress sem alterações
    }

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; 
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase); // Coloca o boneco na última fase liberada
    }

    async function initializePhases() {
        // Função existente de initializePhases sem alterações
    }

    function moveToPhase(index, path = null) {
        // Função existente de moveToPhase sem alterações
    }

    function drawLines() {
        svgContainer.innerHTML = ''; // Limpa o SVG antes de redesenhar as linhas
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = document.querySelectorAll('.phase')[i];
            const phase2 = document.querySelectorAll('.phase')[i + 1];
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

    function renderAllPhases(callback) {
        let originalScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let lastPhase = document.querySelectorAll('.phase').length - 1;

        // Rola até a última fase e, em seguida, volta para o topo
        window.scrollTo(0, document.querySelectorAll('.phase')[lastPhase].offsetTop);
        setTimeout(() => {
            window.scrollTo(0, originalScrollTop); // Retorna à posição original
            callback(); // Chama o callback para desenhar as linhas
        }, 100);
    }

    async function checkForNewUnlock() {
        // Função existente de checkForNewUnlock sem alterações
    }

    window.addEventListener('focus', checkForNewUnlock); // Verifica o progresso ao retornar à página
    window.addEventListener('resize', drawLines); // Redesenha as linhas ao redimensionar a tela
});
