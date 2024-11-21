const gridSize = 15;
const canvas = document.getElementById('word-search-canvas');
const ctx = canvas.getContext('2d');

// Calcula o tamanho das células dinamicamente com base no tamanho do canvas
const cellSize = Math.min(canvas.clientWidth / gridSize, 30);
canvas.width = cellSize * gridSize;
canvas.height = cellSize * gridSize;

let grid = [];
let selectedCells = [];
let foundCells = [];
const wordsList = document.getElementById('words');
let wordsToFind = [];

async function loadWords() {
    try {
        // Caminho atualizado para buscar o arquivo words.txt na pasta data3
        const response = await fetch('../data3/words.txt');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const text = await response.text();
        console.log('Loaded words:', text);
        wordsToFind = text.split(/\r?\n/).filter(word => word.trim() !== '');
        init();
    } catch (error) {
        console.error('Error loading words:', error);
    }
}

function createWordSearchGrid() {
    grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));

    // Coloca as palavras no grid
    wordsToFind.forEach(word => placeWordInGrid(word));

    // Preenche as células vazias com letras aleatórias
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (grid[row][col] === '') {
                grid[row][col] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            }
        }
    }
}

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

function drawWordSearchGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${cellSize * 0.6}px Arial`;
    ctx.fillStyle = '#000'; // Cor preta para as letras

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

function drawSelectedCells() {
    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
    selectedCells.forEach(({ row, col }) => {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    });
}

function displayWordsList() {
    wordsList.innerHTML = '';
    wordsToFind.forEach(word => {
        const li = document.createElement('li');
        li.textContent = word;
        li.onclick = () => markWordInList(word);
        wordsList.appendChild(li);
    });
}

function markWordInList(word) {
    const listItems = wordsList.getElementsByTagName('li');
    for (let item of listItems) {
        if (item.textContent.trim().toUpperCase() === word.trim().toUpperCase()) {
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

    // Adiciona lógica para verificar continuidade das células selecionadas
    if (selectedCells.length > 0) {
        const lastCell = selectedCells[selectedCells.length - 1];

        const isHorizontal = row === lastCell.row;
        const isVertical = col === lastCell.col;
        const isDiagonal1 = row - lastCell.row === col - lastCell.col;
        const isDiagonal2 = row - lastCell.row === lastCell.col - col;

        if (isHorizontal || isVertical || isDiagonal1 || isDiagonal2) {
            selectedCells.push({ row, col });
        } else {
            // Reinicia a seleção se a célula não for contínua
            selectedCells = [{ row, col }];
        }
    } else {
        selectedCells.push({ row, col });
    }

    drawWordSearchGrid();
    drawSelectedCells();
    checkWord();
}

function checkWord() {
    const selectedCellsSorted = [...selectedCells].sort((a, b) => a.row - b.row || a.col - b.col);
    const selectedWord = selectedCellsSorted.map(cell => grid[cell.row][cell.col]).join('');

    if (wordsToFind.includes(selectedWord)) {
        markWordInList(selectedWord);
        foundCells = foundCells.concat(selectedCells);
        selectedCells = [];
        drawWordSearchGrid();
        drawSelectedCells();
    }
}

function resetGame() {
    selectedCells = [];
    foundCells = [];
    init();
}

function init() {
    createWordSearchGrid();
    drawWordSearchGrid();
    displayWordsList();
    canvas.addEventListener('click', handleCanvasClick);
}

document.getElementById('reset-button').addEventListener('click', resetGame);

loadWords();
