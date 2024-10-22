const gridSize = 15;
const canvas = document.getElementById('word-search-canvas');
const ctx = canvas.getContext('2d');

// Configurações do canvas
const cellSize = Math.min(canvas.clientWidth / gridSize, 30);
canvas.width = cellSize * gridSize;
canvas.height = cellSize * gridSize;

// Variáveis globais
let grid = [];
let wordsToFind = [];
let selectedCells = [];
let foundCells = [];

// Função para carregar as palavras da fase
async function loadWords() {
    try {
        const response = await fetch('../data1/words.txt');
        if (!response.ok) throw new Error('Não foi possível carregar as palavras.');

        const text = await response.text();
        wordsToFind = text.split(/\r?\n/).filter(word => word.trim() !== '');
        init(); // Inicializa o jogo após carregar as palavras
    } catch (error) {
        console.error('Erro ao carregar as palavras:', error);
    }
}

// Função para criar a grade do caça-palavras
function createWordSearchGrid() {
    grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));

    wordsToFind.forEach(word => placeWordInGrid(word));

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
        { row: 1, col: 1 }, // Diagonal (principal)
        { row: 1, col: -1 } // Diagonal (secundária)
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

    // Destaca as células encontradas
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    foundCells.forEach(({ row, col }) => {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    });
}

// Função para lidar com cliques no canvas
function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (selectedCells.length > 0) {
        const lastCell = selectedCells[selectedCells.length - 1];

        const isHorizontal = row === lastCell.row;
        const isVertical = col === lastCell.col;
        const isDiagonal1 = row - lastCell.row === col - lastCell.col;
        const isDiagonal2 = row - lastCell.row === lastCell.col - col;

        if (isHorizontal || isVertical || isDiagonal1 || isDiagonal2) {
            selectedCells.push({ row, col });
            drawWordSearchGrid();
            drawSelectedCells();
            checkWord();
        } else {
            selectedCells = [{ row, col }];
            drawWordSearchGrid();
            drawSelectedCells();
        }
    } else {
        selectedCells.push({ row, col });
        drawWordSearchGrid();
        drawSelectedCells();
    }
}

// Função para destacar células selecionadas
function drawSelectedCells() {
    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)'; // Cor azul para seleção
    selectedCells.forEach(({ row, col }) => {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        ctx.fillStyle = '#000'; // Restaura a cor do texto
        ctx.fillText(grid[row][col], col * cellSize + cellSize / 4, row * cellSize + cellSize / 1.5);
    });
}

// Função para verificar se a palavra selecionada está correta
function checkWord() {
    const selectedWord = selectedCells.map(cell => grid[cell.row][cell.col]).join('');
    if (wordsToFind.includes(selectedWord)) {
        foundCells = [...foundCells, ...selectedCells];
        removeFoundWord(selectedWord);
    }
}

// Função para remover a palavra encontrada da lista
function removeFoundWord(word) {
    wordsToFind = wordsToFind.filter(w => w !== word);
    displayWordsList();
    drawWordSearchGrid();
}

// Função para exibir a lista de palavras na tela
function displayWordsList() {
    const wordsListElement = document.getElementById('words');
    wordsListElement.innerHTML = '';

    wordsToFind.forEach(word => {
        const li = document.createElement('li');
        li.textContent = word;
        wordsListElement.appendChild(li);
    });
}

// Função para inicializar o jogo
function init() {
    createWordSearchGrid();
    drawWordSearchGrid();
    displayWordsList();
    canvas.addEventListener('click', handleCanvasClick);
}

// Inicializa o jogo e carrega as palavras
document.getElementById('reset-button').addEventListener('click', init);
document.addEventListener('DOMContentLoaded', loadWords);
