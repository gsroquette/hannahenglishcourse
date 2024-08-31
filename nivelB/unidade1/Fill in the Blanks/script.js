let currentQuestion = 1; // Começa na primeira questão
const totalQuestions = 10; // Total de questões
let tipsVisible = false; // Estado das dicas (visível ou não)
let utterance; // Variável global para o objeto SpeechSynthesisUtterance

function loadText(questionNumber) {
    fetch(`text-with-blanks${questionNumber}.txt`)
        .then(response => response.text())
        .then(text => {
            const container = document.getElementById('textContainer');
            container.innerHTML = text.replace(/\[BLANK\]/g, '<span class="missing-word" contenteditable="true" data-correct-word=""></span>');
        })
        .catch(error => console.error('Erro ao carregar o texto:', error));
}

function loadTips(questionNumber) {
    fetch(`words${questionNumber}.json`)
        .then(response => response.json())
        .then(data => {
            const tipsContainer = document.getElementById('tipsContainer');
            tipsContainer.innerHTML = '';
            const words = data.correctWords;
            words.sort(() => Math.random() - 0.5);

            words.forEach(word => {
                const span = document.createElement('span');
                span.textContent = word;
                span.addEventListener('click', () => {
                    const emptySpaces = document.querySelectorAll('.missing-word');
                    emptySpaces.forEach(space => {
                        if (!space.textContent.trim()) {
                            space.textContent = word;
                            space.setAttribute('data-correct-word', word);
                            return;
                        }
                    });
                });
                tipsContainer.appendChild(span);
            });
        })
        .catch(error => console.error('Erro ao carregar as dicas:', error));
}

function loadCompleteText(questionNumber) {
    fetch(`text-completo${questionNumber}.txt`)
        .then(response => response.text())
        .then(text => {
            if (utterance) {
                speechSynthesis.cancel(); // Interrompe a leitura atual
            }
            utterance = new SpeechSynthesisUtterance(text);
            speechSynthesis.speak(utterance);
        })
        .catch(error => console.error('Erro ao ler o texto:', error));
}

document.getElementById('tipsButton').addEventListener('click', () => {
    const tipsContainer = document.getElementById('tipsContainer');
    tipsVisible = !tipsVisible; // Alterna o estado das dicas
    if (tipsVisible) {
        tipsContainer.classList.remove('hidden');
        loadTips(currentQuestion);
    } else {
        tipsContainer.classList.add('hidden');
        tipsContainer.innerHTML = ''; // Limpa as dicas ao esconder
    }
});

document.getElementById('readButton').addEventListener('click', () => {
    loadCompleteText(currentQuestion);
});

document.getElementById('finishButton').addEventListener('click', () => {
    fetch(`words${currentQuestion}.json`)
        .then(response => response.json())
        .then(data => {
            const missingWords = document.querySelectorAll('.missing-word');
            const correctWords = data.correctWords;
            let allCorrect = true;

            missingWords.forEach((word, index) => {
                const userInput = word.textContent.trim();
                const correctWord = correctWords[index];

                if (userInput === correctWord) {
                    word.style.borderBottom = '2px solid blue';
                } else {
                    word.style.borderBottom = '2px solid red';
                    allCorrect = false;
                }
            });

            if (allCorrect) {
                showSuccess();
            }
        })
        .catch(error => console.error('Erro ao carregar o arquivo words.json:', error));
});

document.getElementById('nextButton').addEventListener('click', () => {
    if (currentQuestion < totalQuestions) {
        currentQuestion++;
        loadText(currentQuestion);
        if (tipsVisible) loadTips(currentQuestion); // Recarrega as dicas se estiverem visíveis
        if (utterance) {
            speechSynthesis.cancel(); // Interrompe a leitura ao mudar de questão
        }
    }
});

document.getElementById('previousButton').addEventListener('click', () => {
    if (currentQuestion > 1) {
        currentQuestion--;
        loadText(currentQuestion);
        if (tipsVisible) loadTips(currentQuestion); // Recarrega as dicas se estiverem visíveis
        if (utterance) {
            speechSynthesis.cancel(); // Interrompe a leitura ao mudar de questão
        }
    }
});

document.getElementById('generatePdfButton').addEventListener('click', generatePDF); // Adiciona a funcionalidade do botão

function showSuccess() {
    const successContainer = document.getElementById('successContainer');
    const successGif = document.getElementById('successGif');
    const successSound = document.getElementById('successSound');
    
    successContainer.classList.remove('hidden');
    
    // Reproduzir o áudio
    successSound.play();
    
    // Exibir o GIF e esconder após 5 segundos
    setTimeout(() => {
        successContainer.classList.add('hidden');
    }, 5000);
}

// Função para gerar o PDF
async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    
    let y = 40; // Posição inicial no eixo y
    const pageHeight = 750; // Altura da página em pontos
    
    doc.setFontSize(24);
    doc.text('Hannah - Fill in the Blanks', 40, y);
    
    y += 40;
    doc.setFontSize(14);
    doc.text('Name: ' + '_'.repeat(100), 40, y);
    
    y += 30;
    doc.text('Date: ' + '_'.repeat(20), 40, y);
    
    y += 40;
    for (let i = 1; i <= totalQuestions; i++) {
        const textResponse = await fetch(`text-with-blanks${i}.txt`);
        const text = await textResponse.text();
        
        doc.setFontSize(12);
        doc.text(`Question ${i}:`, 40, y);
        
        y += 20;
        doc.setFontSize(10);
        const lines = text.split('\n');
        lines.forEach(line => {
            if (y > pageHeight - 40) { // Se a posição y estiver perto do final da página
                doc.addPage();
                y = 40; // Reinicia a posição y
            }
            doc.text(line.replace(/\[BLANK\]/g, '___________'), 40, y, { maxWidth: 500 });
            y += 20;
        });
        
        y += 20;
        const tipsResponse = await fetch(`words${i}.json`);
        const tipsData = await tipsResponse.json();
        const tips = tipsData.correctWords.sort(() => Math.random() - 0.5);
        
        doc.setFontSize(12);
        doc.text('Tips:', 40, y);
        
        y += 20;
        doc.setFontSize(10);
        let xOffset = 40;
        tips.forEach(tip => {
            if (xOffset > 500) { // Se a posição x estiver perto do final da linha
                y += 20; // Avança para a próxima linha
                xOffset = 40; // Reinicia a posição x
            }
            doc.text(tip, xOffset, y);
            xOffset += 50; // Ajusta a posição horizontal
        });
        
        y += 40;
        if (y > pageHeight - 40) { // Se a posição y ultrapassar o limite da página
            doc.addPage();
            y = 40; // Reinicia a posição y
        }
    }
    
    doc.save('Hannah_Fill_in_the_Blanks.pdf');
}

// Carrega a primeira questão ao iniciar
loadText(currentQuestion);
