const gridSize = 15;
const canvas = document.getElementById('word-search-canvas');
const ctx = canvas.getContext('2d');

// Variáveis globais do jogo
let grid = [];
let selectedCells = [];
let foundCells = [];
let wordsToFind = [];

// Configurações do canvas
const cellSize = Math.min(canvas.clientWidth / gridSize, 30);
canvas.width = cellSize * gridSize;
canvas.height = cellSize * gridSize;

// Função para carregar as palavras
async function loadWords() {
    try {
        // Ajuste no caminho do arquivo para garantir o carregamento correto
        const response = await fetch('../data1/words.txt');
        if (!response.ok) throw new Error('Não foi possível carregar as palavras.');
        
        const text = await response.text();
        wordsToFind = text.trim().split('\n');
        
        // Inicializa o jogo após carregar as palavras
        init();
    } catch (error) {
        console.error('Erro ao carregar as palavras:', error);
        alert('Erro ao carregar as palavras. Verifique o arquivo de palavras.');
    }
}

// Função para inicializar o jogo
function init() {
    createWordSearchGrid();
    drawWordSearchGrid();
    displayWordsList();
    canvas.addEventListener('click', handleCanvasClick);
}

// Função para exibir a lista de palavras na tela
function displayWordsList() {
    const wordsListElement = document.getElementById('words');
    wordsListElement.innerHTML = ''; // Limpa a lista antes de adicionar novas palavras

    wordsToFind.forEach(word => {
        const li = document.createElement('li');
        li.textContent = word;
        wordsListElement.appendChild(li);
    });
}

// Função para verificar autenticação do usuário
function ensureUserIsAuthenticated(callback) {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            callback(user.uid);
        } else {
            console.error("Usuário não autenticado");
        }
    });
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
    ensureUserIsAuthenticated(updateNextPhase);
}

// Outras funções do jogo permanecem inalteradas
function createWordSearchGrid() { /* Função original para criar a grade */ }
function drawWordSearchGrid() { /* Função original para desenhar a grade */ }
function handleCanvasClick(event) { /* Função original para lidar com cliques no canvas */ }
function resetGame() { /* Função original para resetar o jogo */ }
function closeModal() { /* Função original para fechar o modal */ }

// Inicializa o jogo
document.getElementById('reset-button').addEventListener('click', resetGame);
document.addEventListener('DOMContentLoaded', loadWords);
