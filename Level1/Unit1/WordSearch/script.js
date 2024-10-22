const gridSize = 15;
const canvas = document.getElementById('word-search-canvas');
const ctx = canvas.getContext('2d');

// Variáveis globais
let grid = [];
let wordsToFind = [];
let selectedCells = [];
let foundWords = [];

// Configurações do canvas
const cellSize = Math.min(canvas.clientWidth / gridSize, 30);
canvas.width = cellSize * gridSize;
canvas.height = cellSize * gridSize;

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
        { row: 0, col: 1 },  // Horizontal
        { row: 1, col: 0 },  // Vertical
        { row: 1, col: 1 },  // Diagonal principal
        { row: 1, col: -1 }  // Diagonal secundária
    ];

    let placed = false;

    while (!placed) {
        const direction = directions[Math.floor(Math.random() * directions.length)];
        let row = Math.floor(Math.random() * gridSize);
        let col = Math.floor(Math.random() * gridSize);

        if (canPlaceWord(grid, word, row, col, direction)) {
            for (let i = 0; i < word.length; i++) {
                grid[row + i * direction.row][col + i * direction.col] = word[i];
            }
            placed = true;
        }
    }
}

// Função para verificar se a palavra pode ser colocada na grade
function canPlaceWord(grid, word, row, col, direction) {
    for (let i = 0; i < word.length; i++) {
        const newRow = row + i * direction.row;
        const newCol = col + i * direction.col;
        if (
            newRow < 0 || newRow >= gridSize || 
            newCol < 0 || newCol >= gridSize || 
            (grid[newRow][newCol] !== '' && grid[newRow][newCol] !== word[i])
        ) {
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
}

// Função para lidar com cliques no canvas
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);

let isSelecting = false;

// Função para iniciar a seleção
function handleMouseDown(event) {
    isSelecting = true;
    const { row, col } = getCellFromCoordinates(event.offsetX, event.offsetY);
    selectedCells = [{ row, col }];
}

// Função para finalizar a seleção
function handleMouseUp(event) {
    if (!isSelecting) return;

    isSelecting = false;
    const { row, col } = getCellFromCoordinates(event.offsetX, event.offsetY);
    selectedCells.push({ row, col });
    
    checkSelectedWord();
}

// Função para obter a célula a partir das coordenadas do mouse
function getCellFromCoordinates(x, y) {
    return {
        row: Math.floor(y / cellSize),
        col: Math.floor(x / cellSize)
    };
}

// Função para verificar se a palavra selecionada está correta
function checkSelectedWord() {
    const selectedWord = selectedCells.map(cell => grid[cell.row][cell.col]).join('');
    
    if (wordsToFind.includes(selectedWord)) {
        foundWords.push(selectedWord);
        highlightSelectedWord();
        checkCompletion();
    }
}

// Função para destacar a palavra encontrada
function highlightSelectedWord() {
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';  // Cor verde com opacidade

    selectedCells.forEach(cell => {
        ctx.fillRect(cell.col * cellSize, cell.row * cellSize, cellSize, cellSize);
    });
}

// Função para verificar se todas as palavras foram encontradas
function checkCompletion() {
    if (foundWords.length === wordsToFind.length) {
        showCompletionModal();
    }
}

// Função para inicializar o jogo
function init() {
    createWordSearchGrid();
    drawWordSearchGrid();
    displayWordsList();
}

// Inicializa o jogo e carrega as palavras
document.addEventListener('DOMContentLoaded', loadWords);
