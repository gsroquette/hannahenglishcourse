// Variáveis globais
let wordSearchCanvas, ctx, grid, wordsToFind, foundCells = [];

// Inicializa o jogo
function initializeGame() {
    wordSearchCanvas = document.getElementById('word-search-canvas');
    ctx = wordSearchCanvas.getContext('2d');
    loadWords();
}

// Carrega as palavras do jogo
function loadWords() {
    wordsToFind = ["JESUS", "BIBLE", "LOVE", "FAITH", "HOPE", "GRACE"]; // Exemplo de palavras
    renderGrid();
    renderWordList();
}

// Renderiza a grade do caça-palavras
function renderGrid() {
    grid = createGrid(10, 10); // Exemplo de grade 10x10
    drawGrid();
}

// Cria a grade do caça-palavras
function createGrid(rows, cols) {
    const grid = [];
    for (let i = 0; i < rows; i++) {
        grid[i] = [];
        for (let j = 0; j < cols; j++) {
            grid[i][j] = ''; // Preenche a grade inicialmente vazia
        }
    }
    return grid;
}

// Desenha a grade do caça-palavras
function drawGrid() {
    const cellSize = wordSearchCanvas.width / grid.length;
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
            ctx.strokeStyle = "#4a90e2";
            ctx.strokeRect(j * cellSize, i * cellSize, cellSize, cellSize);
            ctx.fillStyle = "#000";
            ctx.font = `${cellSize / 2}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(grid[i][j], j * cellSize + cellSize / 2, i * cellSize + cellSize / 2);
        }
    }
}

// Renderiza a lista de palavras a serem encontradas
function renderWordList() {
    const wordsList = document.getElementById('words');
    wordsList.innerHTML = '';
    wordsToFind.forEach(word => {
        const listItem = document.createElement('li');
        listItem.textContent = word;
        wordsList.appendChild(listItem);
    });
}

// Função para verificar se a fase está completa
function checkCompletion() {
    const foundWords = [...new Set(foundCells.map(cell => cell.word))];
    if (foundWords.length === wordsToFind.length) {
        showCompletionModal();
    }
}

// Função para resetar o jogo
function resetGame() {
    foundCells = [];
    renderGrid();
    renderWordList();
}

// Função para exibir o modal de conclusão
function showCompletionModal() {
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('completion-modal').style.display = 'block';
    ensureUserIsAuthenticated(updateNextPhase); // Atualiza o progresso ao concluir a fase
}

// Função para fechar o modal de conclusão
function closeModal() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('completion-modal').style.display = 'none';
}

// Função para capturar fase, level e unit do URL
function getPhaseFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('fase');
}

function getLevelAndUnitFromURL() {
    const url = window.location.pathname;
    const parts = url.split('/');
    const level = parts[1];
    const unit = parts[2];
    return { level, unit };
}

// Função para verificar autenticação do usuário
function ensureUserIsAuthenticated(callback) {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            callback(user.uid);
        } else {
            console.error("Usuário não autenticado");
        }
    });
}

// Função para atualizar o progresso no banco de dados
async function updateNextPhase(userId) {
    const currentPhase = getPhaseFromURL();
    const { level, unit } = getLevelAndUnitFromURL();
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

// Inicializa o jogo ao carregar a página
document.addEventListener('DOMContentLoaded', initializeGame);
document.getElementById('reset-button').addEventListener('click', resetGame);
