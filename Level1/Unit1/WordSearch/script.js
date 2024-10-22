// Variáveis globais
let wordSearchCanvas, ctx, grid, wordsToFind, foundCells = [];

// Inicializa o Firebase (se não estiver inicializado anteriormente)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Função para verificar autenticação do usuário
function ensureUserIsAuthenticated(callback) {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            callback(user.uid); // Executa o callback se o usuário estiver autenticado
        } else {
            console.error("Usuário não autenticado");
            loadWords(); // Continua o jogo mesmo sem autenticação
        }
    });
}

// Função para capturar a fase atual do URL
function getPhaseFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('fase'); // Retorna o valor da fase a partir do URL
}

// Função para capturar o Level atual do URL
function getLevelFromURL() {
    const urlParts = window.location.pathname.split('/');
    return urlParts[1]; // Retorna o Level a partir do URL
}

// Função para capturar a Unit atual do URL
function getUnitFromURL() {
    const urlParts = window.location.pathname.split('/');
    return urlParts[2]; // Retorna a Unit a partir do URL
}

// Função para atualizar o progresso no banco de dados
async function updateNextPhase(userId) {
    const currentPhase = getPhaseFromURL();
    const level = getLevelFromURL();
    const unit = getUnitFromURL();
    const dbRef = firebase.database().ref(`usuarios/${userId}/progresso/${level}/${unit}`);

    try {
        if (currentPhase === "last") {
            const nextUnit = `Unit${parseInt(unit.replace('Unit', '')) + 1}`;
            await firebase.database().ref(`usuarios/${userId}/progresso/${level}/${nextUnit}`).set({ fase1: true });
        } else if (currentPhase === "end") {
            const nextLevel = `Level${parseInt(level.replace('Level', '')) + 1}`;
            await firebase.database().ref(`usuarios/${userId}/progresso/${nextLevel}/Unit1`).set({ fase1: true });
        } else {
            const nextPhase = parseInt(currentPhase) + 1;
            await dbRef.update({ [`fase${currentPhase}`]: true, [`fase${nextPhase}`]: true });
        }
    } catch (error) {
        console.error("Erro ao atualizar o progresso da fase:", error);
    }
}

// Função para exibir o modal de conclusão
function showCompletionModal() {
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('completion-modal').style.display = 'block';
    
    // Chama a função de autenticação e atualização do progresso
    ensureUserIsAuthenticated(updateNextPhase);
}

// Função para fechar o modal de conclusão
function closeModal() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('completion-modal').style.display = 'none';
}

// Inicializa o jogo
function initializeGame() {
    wordSearchCanvas = document.getElementById('word-search-canvas');
    ctx = wordSearchCanvas.getContext('2d');
    ensureUserIsAuthenticated(loadWords); // Verifica se o usuário está autenticado e carrega as palavras
}

// (Resto do código original permanece inalterado)

// Adiciona eventos de inicialização
document.addEventListener('DOMContentLoaded', initializeGame);
document.getElementById('reset-button').addEventListener('click', resetGame);
