const gridSize = 10;
const canvas = document.getElementById('word-search-canvas');
const ctx = canvas.getContext('2d');

// Calcula o tamanho das células dinamicamente com base no tamanho do canvas
const cellSize = Math.min(canvas.clientWidth / gridSize, 50);
canvas.width = cellSize * gridSize;
canvas.height = cellSize * gridSize;

let grid = [];
let selectedCells = [];
let foundCells = [];
const wordsList = document.getElementById('words');
let wordsToFind = [];

// Função para capturar parâmetros level, unit e fase da URL
function getParamsFromURL() {
    const params = new URLSearchParams(window.location.search);
    return {
        level: params.get('level') || 'Level1', // Valor padrão caso o parâmetro esteja ausente
        unit: params.get('unit') || 'Unit1',   // Valor padrão caso o parâmetro esteja ausente
        fase: params.get('fase') || '1'       // Valor padrão caso o parâmetro esteja ausente
    };
}

// Função para verificar se a próxima fase está desbloqueada
async function checkNextPhaseUnlocked() {
    const { level, unit, fase } = getParamsFromURL(); // Obtém os parâmetros da URL
    const nextPhase = parseInt(fase) + 1;
    let isUnlocked = false;

    try {
        const user = await firebase.auth().currentUser;
        if (!user) {
            throw new Error('Usuário não autenticado.');
        }

        const userId = user.uid;
        const dbRef = firebase.database().ref(`usuarios/${userId}/progresso/${level}/${unit}`);
        const snapshot = await dbRef.get();

        if (snapshot.exists()) {
            const progress = snapshot.val();
            isUnlocked = progress[`fase${nextPhase}`] === true; // Verifica se a próxima fase está desbloqueada
        }
    } catch (error) {
        console.error('Erro ao verificar desbloqueio da próxima fase:', error);
    }

    return isUnlocked;
}

// Função para carregar palavras dinamicamente
async function loadWords() {
    const { level, unit } = getParamsFromURL(); // Obtém os parâmetros da URL
    const filePath = `../../${level}/${unit}/data2/words.txt`; // Monta o caminho do arquivo dinamicamente

    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Erro ao carregar o arquivo: ${filePath}`);
        }
        const text = await response.text();
        wordsToFind = text.split(/\r?\n/).filter(word => word.trim() !== '').slice(0, 5); // Seleciona as 5 primeiras palavras válidas
        console.log('Palavras carregadas dinamicamente:', wordsToFind); // Log para verificar as palavras carregadas
        init(); // Inicia o jogo com as palavras carregadas
    } catch (error) {
        console.error('Erro no carregamento dinâmico de palavras:', error);
        alert('Não foi possível carregar as palavras. Verifique o caminho ou a conexão.');
    }
}

// Função para criar a grade do caça-palavras
function createWordSearchGrid() {
    grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));

    wordsToFind.forEach(word => {
        const placed = placeWordInGrid(word);
        if (!placed) {
            console.warn(`Não foi possível posicionar a palavra: ${word}`);
        }
    });

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (grid[row][col] === '') {
                grid[row][col] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            }
        }
    }
}

// Função para colocar uma palavra na grade
function placeWordInGrid(word) {
    const directions = [
        { row: 0, col: 1 }, // Horizontal
        { row: 1, col: 0 }, // Vertical
        { row: 1, col: 1 }, // Diagonal principal
        { row: 1, col: -1 } // Diagonal secundária
    ];

    const direction = directions[Math.floor(Math.random() * directions.length)];
    let row, col;

    do {
        row = Math.floor(Math.random() * gridSize);
        col = Math.floor(Math.random() * gridSize);
    } while (!canPlaceWord(grid, word, row, col, direction));

    for (let i = 0; i < word.length; i++) {
        grid[row + i * direction.row][col + i * direction.col] = word[i];
    }
}

// Função para verificar se a palavra pode ser colocada na grade
function canPlaceWord(grid, word, row, col, direction) {
    for (let i = 0; i < word.length; i++) {
        const newRow = row + i * direction.row;
        const newCol = col + i * direction.col;
        if (newRow < 0 || newRow >= gridSize || newCol < 0 || newCol >= gridSize ||
            (grid[newRow][newCol] !== '' && grid[newRow][newCol] !== word[i])) {
            return false;
        }
    }
    return true;
}

// Função para desenhar a grade do caça-palavras
function drawWordSearchGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${cellSize * 0.6}px Arial`;
    ctx.fillStyle = '#000';

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
            ctx.fillText(grid[row][col], col * cellSize + cellSize / 4, row * cellSize + cellSize / 1.5);
        }
    }

    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    foundCells.forEach(({ row, col }) => {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    });
}

// Função para destacar as células selecionadas
function drawSelectedCells() {
    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
    selectedCells.forEach(({ row, col }) => {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    });
}

// Função para exibir a lista de palavras a serem encontradas
function displayWordsList() {
    wordsList.innerHTML = '';
    wordsToFind.forEach(word => {
        const li = document.createElement('li');
        li.textContent = word;
        li.onclick = () => markWordInList(word);
        wordsList.appendChild(li);
    });
}

// Função para marcar a palavra encontrada na lista
function markWordInList(word) {
    const listItems = wordsList.getElementsByTagName('li');
    for (let item of listItems) {
        if (item.textContent === word) {
            item.style.textDecoration = 'line-through';
            break;
        }
    }
}

// Função para lidar com o clique no canvas
function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    // Verifica se a célula já foi selecionada
    if (selectedCells.some(cell => cell.row === row && cell.col === col)) {
        return; // Se a célula já foi selecionada, não faz nada
    }

    if (selectedCells.length > 0) {
        const lastCell = selectedCells[selectedCells.length - 1];

        const isHorizontal = row === lastCell.row;
        const isVertical = col === lastCell.col;
        const isDiagonal1 = row - lastCell.row === col - lastCell.col;
        const isDiagonal2 = row - lastCell.row === lastCell.col - col;

        if (isHorizontal || isVertical || isDiagonal1 || isDiagonal2) {
            selectedCells.push({ row, col });
        } else {
            selectedCells = [{ row, col }];
        }
    } else {
        selectedCells.push({ row, col });
    }

    drawWordSearchGrid();
    drawSelectedCells();
    checkWord();
}

// Função para verificar se uma palavra foi encontrada
function checkWord() {
    const selectedCellsSorted = [...selectedCells].sort((a, b) => a.row - b.row || a.col - b.col);
    const selectedWord = selectedCellsSorted.map(cell => grid[cell.row][cell.col]).join('');

    if (wordsToFind.includes(selectedWord)) {
        markWordInList(selectedWord);
        foundCells.push(...selectedCells.map(cell => ({ ...cell, word: selectedWord })));
        selectedCells = [];
        drawWordSearchGrid();
        drawSelectedCells();
        checkCompletion(); // Verifica se a fase está completa
    }
}

// Função para verificar se a fase está completa
function checkCompletion() {
    const foundWords = [...new Set(foundCells.map(cell => cell.word))];
    if (foundWords.length === wordsToFind.length) {
        showCompletionModal();
        completePhase(); // Chama a função de completar fase
    }
}

// Função para iniciar o processo de atualização após a conclusão
function completePhase() {
    ensureUserIsAuthenticated(updateNextPhase);
}

// Função para capturar fase, level e unit do URL
function getPhaseFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('fase');
}

function getLevelAndUnitFromURL() {
    const params = new URLSearchParams(window.location.search);
    return {
        level: params.get('level'),
        unit: params.get('unit')
    };
}

// Função para verificar autenticação do usuário
function ensureUserIsAuthenticated(callback) {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log("Usuário autenticado, UID:", user.uid);
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
            console.log(`Nova unidade criada: ${nextUnit}, com fase1 desbloqueada.`);
        } else if (currentPhase === "end") {
            const nextLevel = `Level${parseInt(level.replace('Level', '')) + 1}`;
            await firebase.database().ref(`usuarios/${userId}/progresso/${nextLevel}/Unit1`).set({ fase1: true });
            console.log(`Novo nível criado: ${nextLevel}, com Unit1 e fase1 desbloqueadas.`);
        } else {
            const nextPhase = parseInt(currentPhase) + 1;
            await dbRef.update({ [`fase${currentPhase}`]: true, [`fase${nextPhase}`]: true });
            console.log(`Fase atual (${currentPhase}) e próxima fase (${nextPhase}) desbloqueadas.`);
        }
    } catch (error) {
        console.error("Erro ao atualizar o progresso da fase:", error);
    }
}

// Função para reiniciar o jogo
function resetGame() {
    selectedCells = [];
    foundCells = [];
    init();
}

// Função para exibir o modal de conclusão
function showCompletionModal() {
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('completion-modal').style.display = 'block';
}

// Função para fechar o modal de conclusão
function closeModal() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('completion-modal').style.display = 'none';
}

// Função para inicializar o jogo
function init() {
    console.log('Inicializando o jogo...');
    createWordSearchGrid();
    drawWordSearchGrid();
    displayWordsList();
    console.log('Grade:', grid); // Log para verificar a grade
    canvas.addEventListener('click', handleCanvasClick);
}

// Inicializa o jogo e carrega as palavras
document.getElementById('reset-button').addEventListener('click', resetGame);
// Inicializa o jogo e carrega as palavras dinamicamente
document.getElementById('reset-button').addEventListener('click', resetGame);
loadWords(); // Chama a nova função com carregamento dinâmico
// Evento para o botão Back
document.getElementById('back-button').addEventListener('click', async () => {
    const isUnlocked = await checkNextPhaseUnlocked();

    if (!isUnlocked) {
        // Exibe mensagem de aviso caso a próxima fase não esteja desbloqueada
        const confirmNavigation = confirm(
            "The next phase is not unlocked yet. Do you still want to go back?"
        );
        if (!confirmNavigation) {
            return; // Cancela a navegação se o usuário não confirmar
        }
    }

    // Navega para a página anterior
    history.back();
});

