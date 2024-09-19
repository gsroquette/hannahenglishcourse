const gridSize = 15;
const canvas = document.getElementById('word-search-canvas');
const ctx = canvas.getContext('2d');

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
        const response = await fetch('words.txt');
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

    wordsToFind.forEach(word => placeWordInGrid(word));

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
        if (item.textContent === word) {
            item.style.textDecoration = 'line-through';
            break;
        }
    }
}

function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

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
