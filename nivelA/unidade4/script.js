document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "Flashcards2", path: "../unidade2/Flashcards2/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 4, name: "Flashcards3", path: "../unidade2/Flashcards3/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 5, name: "MemoryGame", path: "../unidade2/MemoryGame/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 6, name: "MemoryGame2", path: "../unidade2/MemoryGame2/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 7, name: "MemoryGame3", path: "../unidade2/MemoryGame3/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 8, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" },
        { id: 9, name: "WordSearch", path: "../unidade2/WordSearch/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 10, name: "WordSearch2", path: "../unidade2/WordSearch2/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 11, name: "WordSearch3", path: "../unidade2/WordSearch3/index.html", img: "../../imagens/botoes/wordsearch_button.png" },
        { id: 12, name: "Grammar", path: "../unidade2/Grammar/index.html", img: "../../imagens/botoes/grammar_button.png" },
        { id: 13, name: "Fill in the Blanks", path: "../unidade2/Fill in the Blanks/index.html", img: "../../imagens/botoes/fillintheblanks_button.png" },
        { id: 14, name: "Mixed Letters FIXO", path: "../unidade2/Mixed Letters FIXO/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 15, name: "Mixed Letters FIXO2", path: "../unidade2/Mixed Letters FIXO2/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 16, name: "Mixed Letters FIXO3", path: "../unidade2/Mixed Letters FIXO3/index.html", img: "../../imagens/botoes/mixed_letters_students.png" },
        { id: 17, name: "Missing Word", path: "../unidade2/Missing Word/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 18, name: "Missing Word2", path: "../unidade2/Missing Word2/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 19, name: "Missing Word3", path: "../unidade2/Missing Word3/index.html", img: "../../imagens/botoes/missing_word_button.png" },
        { id: 20, name: "Speak", path: "../unidade2/Speak/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 21, name: "Speak2", path: "../unidade2/Speak2/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 22, name: "Speak3", path: "../unidade2/Speak3/index.html", img: "../../imagens/botoes/speak_button.png" },
        { id: 23, name: "MatchingGame", path: "../unidade2/MatchingGame/index.html", img: "../../imagens/botoes/matching_game_button.png" }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;
    let player;
    let positionLeft = true; // Inicia pela esquerda

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png';
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    // Função para carregar fases visíveis
    function loadVisiblePhases(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const phaseDiv = entry.target;
                const phaseIndex = parseInt(phaseDiv.getAttribute('data-index'));

                if (!phaseDiv.dataset.loaded) {
                    const activity = activities[phaseIndex];
                    const phaseImage = document.createElement('img');
                    phaseImage.src = activity.img;
                    phaseImage.alt = activity.name;
                    phaseImage.classList.add('phase-img');
                    phaseDiv.appendChild(phaseImage);
                    
                    phaseDiv.dataset.loaded = true; // Marca a fase como carregada

                    if (phaseIndex === currentPhase) {
                        phaseDiv.classList.add('active');
                    } else if (phaseIndex > currentPhase) {
                        phaseDiv.classList.add('locked');
                        const lockIcon = document.createElement('img');
                        lockIcon.src = '../../imagens/lock_icon_resized.png';
                        lockIcon.classList.add('lock-icon');
                        phaseDiv.appendChild(lockIcon);
                    }

                    phaseDiv.addEventListener('click', () => {
                        if (!phaseDiv.classList.contains('locked')) {
                            moveToPhase(phaseIndex, activity.path, phaseIndex);
                        }
                    });

                    // Chama o desenho das linhas sempre que uma nova fase é carregada
                    drawLines();
                }
            }
        });
    }

    const observer = new IntersectionObserver(loadVisiblePhases, {
        root: null, // Usa a janela do navegador como root
        rootMargin: '0px',
        threshold: 0.1 // Carrega quando 10% da fase está visível
    });

    // Função para criar todas as fases
    function createPhases() {
        activities.forEach((activity, index) => {
            const phaseDiv = document.createElement('div');
            phaseDiv.classList.add('phase');
            phaseDiv.setAttribute('data-index', index); // Adiciona um índice para referência

            const baseTopPosition = 200;
            const randomVerticalGap = Math.random() * (30 - 20) + 20;
            let topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;
            let horizontalPosition;

            // Alterna entre esquerda e direita
            if (positionLeft) {
                horizontalPosition = Math.random() * (20 - 5) + 5; // Posição aleatória à esquerda
            } else {
                horizontalPosition = Math.random() * (95 - 80) + 80; // Posição aleatória à direita
            }
            positionLeft = !positionLeft; // Alterna a posição para a próxima fase

            // Define as posições calculadas
            phaseDiv.style.top = `${topPosition}px`;
            phaseDiv.style.left = `${horizontalPosition}%`;

            mapContainer.appendChild(phaseDiv);

            // Adiciona a fase ao observer para carregamento
            observer.observe(phaseDiv);
        });
    }

    function moveToPhase(index, path = null, clickedIndex = null) {
        const phase = document.querySelectorAll('.phase')[index];
        const coords = phase.getBoundingClientRect();
        document.querySelectorAll('.phase').forEach(phase => { phase.classList.remove('active'); });
        phase.classList.add('active');

        player.style.top = `${coords.top + window.scrollY + coords.height / 2}px`;
        player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
        player.classList.add('moving');

        const phaseInView = phase.getBoundingClientRect().top >= 0 && phase.getBoundingClientRect().bottom <= window.innerHeight;
        if (!phaseInView) {
            window.scrollTo({
                top: coords.top + window.scrollY - window.innerHeight / 2,
                behavior: 'smooth'
            });
        }

        if (clickedIndex !== null && clickedIndex < activities.length - 1) {
            setTimeout(() => {
                unlockNextPhase(clickedIndex, path);
                updateLineColor(clickedIndex);
            }, 600);
        }
    }

    function unlockNextPhase(index, path) {
        if (index < activities.length - 1) {
            const nextPhase = document.querySelectorAll('.phase')[index + 1];
            nextPhase.classList.remove('locked');
            nextPhase.classList.add('unlocked');

            const lockIcon = mapContainer.querySelector('.lock-icon');
            if (lockIcon) {
                lockIcon.remove();
            }

            const nextPhaseCoords = nextPhase.getBoundingClientRect();
            window.scrollTo({
                top: nextPhaseCoords.top + window.scrollY - window.innerHeight / 2,
                behavior: 'smooth'
            });

            mapContainer.style.transform = 'scale(1.5)';
            mapContainer.style.transition = 'transform 1s ease';

            setTimeout(() => {
                const unlockGif = document.createElement('img');
                unlockGif.src = '../../imagens/cadeado.gif'; 
                unlockGif.classList.add('unlock-gif');
                nextPhase.appendChild(unlockGif);

                unlockGif.style.position = 'absolute';
                unlockGif.style.top = '50%';
                unlockGif.style.left = '50%';
                unlockGif.style.transform = 'translate(-50%, -50%)';

                setTimeout(() => {
                    unlockGif.remove();
                    mapContainer.style.transform = 'scale(1)';

                    setTimeout(() => {
                        const clickedPhase = document.querySelectorAll('.phase')[index];
                        const clickedCoords = clickedPhase.getBoundingClientRect();
                        window.scrollTo({
                            top: clickedCoords.top + window.scrollY - window.innerHeight / 2,
                            behavior: 'smooth'
                        });

                        setTimeout(() => {
                            window.location.href = path;
                        }, 600);
                    }, 1000);
                }, 3000);
            }, 1000);
        }
    }

    // Função para desenhar linhas entre as fases
    function drawLines() {
        svgContainer.innerHTML = ''; // Limpa o SVG antes de desenhar as linhas
        const phases = document.querySelectorAll('.phase');
        for (let i = 0; i < phases.length - 1; i++) {
            const phase1 = phases[i];
            const phase2 = phases[i + 1];
            const coords1 = phase1.getBoundingClientRect();
            const coords2 = phase2.getBoundingClientRect();

            const controlPointX1 = coords1.left + (coords2.left - coords1.left) * 0.33;
            const controlPointY1 = coords1.top + (coords2.top - coords1.top) * 0.33 + 150;
            const controlPointX2 = coords1.left + (coords2.left - coords1.left) * 0.66;
            const controlPointY2 = coords2.top - 150;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${coords1.left + coords1.width / 2} ${coords1.top + coords1.height / 2} 
                       C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, 
                       ${coords2.left + coords2.width / 2} ${coords2.top + coords2.height / 2}`;
            path.setAttribute('d', d);
            path.setAttribute('class', `path path-blue`);
            svgContainer.appendChild(path);
        }
    }

    function updateLineColor(index) {
        const paths = document.querySelectorAll('.path');
        if (paths[index]) {
            paths[index].classList.remove('path-blue');
            paths[index].classList.add('path-purple');
        }
    }

    createPhases();
    drawLines(); // Desenha as linhas na inicialização
    createPlayer();
    window.addEventListener('resize', drawLines); // Redesenha as linhas ao redimensionar a janela
});
