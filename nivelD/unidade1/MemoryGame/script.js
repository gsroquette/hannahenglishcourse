const cardsArray = [
    { name: 'BATTLEFIELD', img: 'imagem1.jpeg' },
    { name: 'GIANT', img: 'imagem2.jpeg' },
    { name: 'FEAR', img: 'imagem3.jpeg' },
    { name: 'BRAVE', img: 'imagem4.jpeg' },
    { name: 'SHEPHERD', img: 'imagem5.jpeg' },
    { name: 'SOLDIER', img: 'imagem6.jpeg' },
    { name: 'SHOUTING', img: 'imagem7.jpeg' },
    { name: 'STONES', img: 'imagem8.jpeg' },
    { name: 'SLINGSHOT', img: 'imagem9.jpeg' },
    { name: 'FOREHEAD', img: 'imagem10.jpeg' }
];

const textArray = cardsArray.map(item => ({ name: item.name, text: item.name }));

let gameGrid = cardsArray.concat(textArray).sort(() => 0.5 - Math.random());
let firstGuess = '';
let secondGuess = '';
let count = 0;
let previousTarget = null;
let delay = 1200;
let moves = 0;

const game = document.getElementById('game-board');

gameGrid.forEach(item => {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.name = item.name;

    if (item.img) {
        const img = document.createElement('img');
        img.src = item.img;
        img.alt = item.name;
        card.appendChild(img);
    } else {
        const span = document.createElement('span');
        span.textContent = item.text;
        card.appendChild(span);
    }

    game.appendChild(card);
});

game.addEventListener('click', function (event) {
    let clicked = event.target.closest('.card');

    if (
        !clicked ||
        clicked === previousTarget ||
        clicked.classList.contains('flipped') ||
        clicked.classList.contains('matched')
    ) {
        return;
    }

    if (count < 2) {
        count++;
        if (count === 1) {
            firstGuess = clicked.dataset.name;
            clicked.classList.add('flipped');
        } else {
            secondGuess = clicked.dataset.name;
            clicked.classList.add('flipped');
            moves++;
            document.getElementById('move-counter').textContent = moves;

            if (firstGuess === secondGuess) {
                setTimeout(() => {
                    match(clicked);
                }, delay);
            } else {
                setTimeout(resetGuesses, delay);
            }
        }
        previousTarget = clicked;
    }
});

function match() {
    let selected = document.querySelectorAll('.flipped');
    selected.forEach(card => {
        card.classList.add('matched');
    });
    resetGuesses(true);
}

function resetGuesses(skipResetFlipped = false) {
    firstGuess = '';
    secondGuess = '';
    count = 0;
    previousTarget = null;

    if (!skipResetFlipped) {
        let selected = document.querySelectorAll('.flipped:not(.matched)');
        selected.forEach(card => {
            card.classList.remove('flipped');
        });
    }
}

document.getElementById('restart').addEventListener('click', function () {
    game.innerHTML = '';
    moves = 0;
    document.getElementById('move-counter').textContent = moves;
    gameGrid = cardsArray.concat(textArray).sort(() => 0.5 - Math.random());
    gameGrid.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.name = item.name;

        if (item.img) {
            const img = document.createElement('img');
            img.src = item.img;
            img.alt = item.name;
            card.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.textContent = item.text;
            card.appendChild(span);
        }

        game.appendChild(card);
    });
});
