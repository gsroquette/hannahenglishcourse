document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "StoryCards", path: "../unidade2/StoryCards/index.html", img: "../../imagens/botoes/storycards_button.png" },
        { id: 2, name: "Flashcards", path: "../unidade2/Flashcards/index.html", img: "../../imagens/botoes/flashcards_button.png" },
        { id: 3, name: "MemoryGame", path: "../unidade2/MemoryGame/index.html", img: "../../imagens/botoes/memorygame_button.png" },
        { id: 4, name: "QUIZ", path: "../unidade2/QUIZ/index.html", img: "../../imagens/botoes/quiz_button.png" },
        { id: 5, name: "WordSearch", path: "../unidade2/WordSearch/index.html", img: "../../imagens/botoes/wordsearch_button.png" }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;
    let player;

    function createPlayer() {
        player = document.createElement('img');
        player.src = '../../imagens/bonequinho.png'; // Caminho da imagem do bonequinho
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase); // Posicionar o bonequinho na fase inicial
    }

    activities.forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');

        const baseTopPosition = 200;
        const randomVerticalGap = Math.random() * (25 - 15) + 15;
        const topPosition = baseTopPosition + index * randomVerticalGap * window.innerHeight / 100;
        const randomLeft = Math.random() * (90 - 10) + 10;

        phaseDiv.style.top = `${topPosition}px`;
        phaseDiv.style.left = `${randomLeft}%`;

        const phaseImage = document.createElement('img');
        phaseImage.src = activity.img;
        phaseImage.alt = activity.name;
        phaseImage.classList.add('phase-img');
        phaseDiv.appendChild(phaseImage);

        mapContainer.appendChild(phaseDiv);

        if (index === currentPhase) {
            phaseDiv.classList.add('active');
        } else if (index > currentPhase) {
            phaseDiv.classList.add('locked');

            const lockIcon = document.createElement('img');
            lockIcon.src = '../../imagens/lock_icon_resized.png';
            lockIcon.classList.add('lock-icon');
            mapContainer.appendChild(lockIcon);

            lockIcon.style.top = `${topPosition}px`;
            lockIcon.style.left = `${randomLeft}%`;
        }

        phaseDiv.addEventListener('click', () => {
            if (!phaseDiv.classList.contains('locked')) {
                moveToPhase(index, activity.path, index);
            }
        });
    });

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

        if (path) {
            setTimeout(() => {
                window.location.href = path;
            }, 600);
        }

        if (clickedIndex !== null && clickedIndex < activities.length - 1) {
            setTimeout(() => {
                unlockNextPhase(clickedIndex);
            }, 600);
        }
    }

    function unlockNextPhase(index) {
        if (index < activities.length - 1) {
            const nextPhase = document.querySelectorAll('.phase')[index + 1];
            nextPhase.classList.remove('locked');
            nextPhase.classList.add('unlocked');

            const lockIcon = mapContainer.querySelector('.lock-icon');
            if (lockIcon) {
                lockIcon.remove();
            }
        }
    }

    // Função para redesenhar as linhas
    function drawLines() {
        svgContainer.innerHTML = ''; // Limpar o SVG antes de redesenhar as linhas
        console.log('Drawing lines...'); // Log de debug para ver se a função está sendo chamada

        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = document.querySelectorAll('.phase')[i];
            const phase2 = document.querySelectorAll('.phase')[i + 1];
            const coords1 = phase1.getBoundingClientRect();
            const coords2 = phase2.getBoundingClientRect();

            // Log para verificar as coordenadas
            console.log(`Fase ${i} coordenadas: `, coords1, `Próxima fase ${i + 1} coordenadas: `, coords2);

            const controlPointX1 = coords1.left + (coords2.left - coords1.left) * 0.33;
            const controlPointY1 = coords1.top + (coords2.top - coords1.top) * 0.33 + 150;
            const controlPointX2 = coords1.left + (coords2.left - coords1.left) * 0.66;
            const controlPointY2 = coords2.top - 150;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${coords1.left + coords1.width / 2} ${coords1.top + coords1.height / 2} 
                       C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, 
                       ${coords2.left + coords2.width / 2} ${coords2.top + coords2.height / 2}`;
            path.setAttribute('d', d);
            path.setAttribute('stroke', 'black');
            path.setAttribute('stroke-dasharray', '15,10');
            path.setAttribute('fill', 'transparent');
            path.setAttribute('stroke-width', '6');
            svgContainer.appendChild(path);

            // Log para garantir que os elementos <path> estão sendo adicionados ao SVG
            console.log('Path adicionado: ', path);
        }

        // Adicionar um retângulo temporário para ver se o SVG está visível
        const tempRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        tempRect.setAttribute('x', '10');
        tempRect.setAttribute('y', '10');
        tempRect.setAttribute('width', '100');
        tempRect.setAttribute('height', '100');
        tempRect.setAttribute('stroke', 'red');
        tempRect.setAttribute('fill', 'none');
        svgContainer.appendChild(tempRect);
        console.log('Retângulo temporário adicionado para debug.');
    }

    function checkImagesLoaded(callback) {
        const images = document.querySelectorAll('img');
        let loadedImagesCount = 0;

        images.forEach(img => {
            img.onload = function() {
                loadedImagesCount++;
                if (loadedImagesCount === images.length) {
                    callback(); // Executa o callback quando todas as imagens estiverem carregadas
                }
            };
        });
    }

    // Carregar página e redesenhar após todas as imagens estarem prontas
    window.onload = function() {
        checkImagesLoaded(() => {
            setTimeout(() => {
                requestAnimationFrame(drawLines); // Redesenhar as linhas após todas as imagens serem carregadas
                createPlayer();
            }, 300); // Atraso para garantir que o layout esteja pronto
        });
    };

    window.addEventListener('resize', debounce(() => {
        setTimeout(() => {
            requestAnimationFrame(drawLines);
        }, 100);
    }, 100));
});
