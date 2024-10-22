const gridSize = 15;
const canvas = document.getElementById('word-search-canvas');
const ctx = canvas.getContext('2d');

// Variáveis globais
let grid = [];
let wordsToFind = [];
let selectedCells = [];
let isSelecting = false;

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

// Função para lidar com eventos de clique no canvas
canvas.addEventListener('mousedown', startSelection);
canvas.addEventListener('mousemove', continueSelection);
canvas.addEventListener('mouseup', endSelection);

// Função para iniciar a seleção
function startSelection(event) {
    isSelecting = true;
    selectedCells = [];
    const cell = getCellFromMouse(event);
    if (cell) {
        selectedCells.push(cell);
        highlightCell(cell, 'rgba(0, 0, 255, 0.3)'); // Destaque inicial
    }
}

// Função para continuar a seleção
function continueSelection(event) {
    if (!isSelecting) return;

    const cell = getCellFromMouse(event);
    if (cell && !isCellSelected(cell)) {
        selectedCells.push(cell);
        highlightCell(cell, 'rgba(0, 0, 255, 0.3)'); // Destaque ao selecionar
    }
}

// Função para finalizar a seleção
function endSelection() {
    if (isSelecting) {
        isSelecting = false;
        const selectedWord = selectedCells.map(cell => grid[cell.row][cell.col]).join('');
        checkSelectedWord(selectedWord); // Verifica a palavra selecionada
        selectedCells = [];  // Limpa a seleção
    }
}

// Função para obter a célula a partir das coordenadas do mouse
function getCellFromMouse(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const row = Math.floor(y / cellSize);
    const col = Math.floor(x / cellSize);

    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        return { row, col };
    }
    return null;
}

// Função para verificar se a célula já foi selecionada
function isCellSelected(cell) {
    return selectedCells.some(selectedCell => selectedCell.row === cell.row && selectedCell.col === cell.col);
}

// Função para destacar a célula selecionada
function highlightCell(cell, color) {
    ctx.fillStyle = color;
    ctx.fillRect(cell.col * cellSize, cell.row * cellSize, cellSize, cellSize);
    ctx.fillStyle = '#000'; // Restaura a cor da letra
    ctx.fillText(grid[cell.row][cell.col], cell.col * cellSize + cellSize / 4, cell.row * cellSize + cellSize / 1.5);
}

// Função para verificar se a palavra selecionada está correta
function checkSelectedWord(selectedWord) {
    // Ignora a seleção se não houver células selecionadas
    if (!selectedWord || selectedWord.length === 0) return;

    // Verifica se a palavra está na lista de palavras
    if (wordsToFind.includes(selectedWord)) {
        // Destaque final para palavra encontrada
        selectedCells.forEach(cell => highlightCell(cell, 'rgba(0, 255, 0, 0.3)')); // Destaque em verde
        removeFoundWord(selectedWord); // Remove a palavra encontrada da lista
    } else {
        // Limpa a seleção se a palavra estiver incorreta
        selectedCells.forEach(cell => highlightCell(cell, 'rgba(255, 0, 0, 0.3)')); // Destaque em vermelho
    }
}

// Função para remover a palavra encontrada da lista
function removeFoundWord(word) {
    wordsToFind = wordsToFind.filter(w => w !== word);
    displayWordsList();
}

// Função para inicializar o jogo
function init() {
    createWordSearchGrid();
    drawWordSearchGrid();
    displayWordsList();
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

// Inicializa o jogo e carrega as palavras
document.getElementById('reset-button').addEventListener('click', init);
document.addEventListener('DOMContentLoaded', loadWords);
