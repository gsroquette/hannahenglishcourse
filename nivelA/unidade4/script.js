document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "Fase 1", top: '10%', left: '10%' },
        { id: 2, name: "Fase 2", top: '25%', left: '30%' },
        { id: 3, name: "Fase 3", top: '50%', left: '50%' },
        { id: 4, name: "Fase 4", top: '70%', left: '70%' },
        { id: 5, name: "Fase 5", top: '90%', left: '20%' }
    ];

    const mapContainer = document.getElementById('mapContainer');
    const svgContainer = document.getElementById('linesSvg');

    // Adicionar fases no mapa
    activities.forEach(activity => {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');
        phaseDiv.style.top = activity.top;
        phaseDiv.style.left = activity.left;
        
        const phaseText = document.createElement('span');
        phaseText.textContent = activity.name;
        phaseDiv.appendChild(phaseText);

        mapContainer.appendChild(phaseDiv);
    });

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
