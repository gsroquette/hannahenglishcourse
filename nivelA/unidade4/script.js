document.addEventListener('DOMContentLoaded', function() {
    const activities = [
        { id: 1, name: "Fase 1", top: '10%', left: '10%' },
        { id: 2, name: "Fase 2", top: '25%', left: '30%' },
        { id: 3, name: "Fase 3", top: '50%', left: '50%' },
        { id: 4, name: "Fase 4", top: '70%', left: '70%' },
        { id: 5, name: "Fase 5", top: '90%', left: '20%' }
    ];

    const mapContainer = document.getElementById('mapContainer');

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
});
