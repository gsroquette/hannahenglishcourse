// Função para mover o bonequinho entre as fases
function movePlayerToPhase(player, phase) {
    const phasePosition = phase.getBoundingClientRect();
    const playerPosition = player.getBoundingClientRect();

    const offsetX = phasePosition.left - playerPosition.left;
    const offsetY = phasePosition.top - playerPosition.top;

    player.style.left = `${player.offsetLeft + offsetX}px`;
    player.style.top = `${player.offsetTop + offsetY}px`;
}

// Função para desbloquear a próxima fase
function unlockNextPhase(currentPhase) {
    const nextPhase = currentPhase.nextElementSibling;
    if (nextPhase && nextPhase.classList.contains('locked')) {
        nextPhase.classList.remove('locked');
        nextPhase.classList.add('unlocked');
        const lockIcon = nextPhase.querySelector('.lock-icon');
        if (lockIcon) {
            lockIcon.remove();
        }
        nextPhase.querySelector('a').classList.remove('disabled-link');
    }
}

// Exemplo de inicialização
document.querySelectorAll('.phase').forEach(phase => {
    phase.addEventListener('click', () => {
        const player = document.querySelector('.player');
        movePlayerToPhase(player, phase);

        setTimeout(() => {
            unlockNextPhase(phase);
        }, 600); // Espera 600ms para mover o bonequinho antes de desbloquear a próxima fase
    });
});
