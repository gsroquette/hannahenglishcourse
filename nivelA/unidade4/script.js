document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "Fase 1", top: '10%', left: '10%', image: '../../imagens/fase1.png' },
        { id: 2, name: "Fase 2", top: '25%', left: '30%', image: '../../imagens/fase2.png' },
        { id: 3, name: "Fase 3", top: '50%', left: '50%', image: '../../imagens/fase3.png' },
        { id: 4, name: "Fase 4", top: '70%', left: '70%', image: '../../imagens/fase4.png' },
        { id: 5, name: "Fase 5", top: '90%', left: '20%', image: '../../imagens/fase5.png' }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');
    let currentPhase = 0;

    // Adicionar fases no mapa
    activities.forEach((activity, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');
        phaseDiv.style.top = activity.top;
        phaseDiv.style.left = activity.left;

        // Adicionar a imagem da fase
        const phaseImage = document.createElement('img');
        phaseImage.src = activity.image;
        phaseImage.classList.add('phase-image');
        phaseDiv.appendChild(phaseImage);

        // Definir fases bloqueadas/desbloqueadas
        if (index === currentPhase) {
            phaseDiv.classList.add('active'); // A fase ativa
        } else if (index > currentPhase) {
            phaseDiv.classList.add('locked'); // Fases bloqueadas

            // Adicionar ícone de cadeado na fase bloqueada
            const lockIcon = document.createElement('img');
            lockIcon.src = '../../imagens/lock_icon_resized.png'; // Caminho para o ícone de cadeado
            lockIcon.classList.add('lock-icon');
            phaseDiv.appendChild(lockIcon);
        }

        phaseDiv.addEventListener('click', () => {
            if (!phaseDiv.classList.contains('locked')) {
                unlockNextPhase(index);
            }
        });

        mapContainer.appendChild(phaseDiv);
    });

    // Função para desbloquear a próxima fase
    function unlockNextPhase(index) {
        if (index < activities.length - 1) {
            const nextPhase = document.querySelectorAll('.phase')[index + 1];
            nextPhase.classList.remove('locked');
            nextPhase.classList.add('unlocked');
            setTimeout(() => {
                nextPhase.querySelector('.lock-icon').remove(); // Remover o cadeado
            }, 1000); // Duração da animação
        }
    }

    // Função para calcular as coordenadas absolutas
    function getCoords(phase) {
        const rect = phase.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    // Desenhar as linhas entre as fases
    function drawLines() {
        svgContainer.innerHTML = ''; // Limpar SVG antes de desenhar
        for (let i = 0; i < activities.length - 1; i++) {
            const phase1 = document.querySelectorAll('.phase')[i];
            const phase2 = document.querySelectorAll('.phase')[i + 1];

            const coords1 = getCoords(phase1);
            const coords2 = getCoords(phase2);

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${coords1.x} ${coords1.y} Q ${coords1.x + 100} ${coords1.y + 100}, ${coords2.x} ${coords2.y}`;
            path.setAttribute('d', d);
            path.setAttribute('stroke', 'black');
            path.setAttribute('stroke-dasharray', '15,10'); // Traços mais longos para efeito de mapa do tesouro
            path.setAttribute('fill', 'transparent');
            path.setAttribute('stroke-width', '6'); // Espessura da linha
            svgContainer.appendChild(path);
        }
    }

    // Desenhar as linhas após o carregamento
    drawLines();

    // Recalcular as linhas ao redimensionar a tela
    window.addEventListener('resize', drawLines);
});
