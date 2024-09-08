let showImages = true;

document.getElementById('toggleButton').addEventListener('click', () => {
    showImages = !showImages;
    document.getElementById('toggleButton').textContent = showImages ? 'Read the story' : 'Tell the story';
    loadCards();
});

function loadCards() {
    const container = document.getElementById('container');
    container.innerHTML = ''; // Limpar o container

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            data.forEach(item => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'card';

                if (showImages) {
                    const imgElement = document.createElement('img');
                    imgElement.src = item.image;
                    cardDiv.appendChild(imgElement);

                    cardDiv.addEventListener('click', () => {
                        fetch(item.text)
                            .then(response => response.text())
                            .then(textContent => {
                                readText(textContent);
                            })
                            .catch(error => console.error('Erro ao carregar texto:', error));
                    });
                } else {
                    fetch(item.text)
                        .then(response => response.text())
                        .then(textContent => {
                            const pElement = document.createElement('p');
                            pElement.textContent = textContent;
                            cardDiv.appendChild(pElement);

                            cardDiv.addEventListener('click', () => {
                                readText(textContent);
                            });
                        })
                        .catch(error => console.error('Erro ao carregar texto:', error));
                }

                container.appendChild(cardDiv);
            });
        })
        .catch(error => console.error('Erro ao carregar os dados:', error));
}

function readText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
}

// Carregar imagens por padrão
loadCards();
