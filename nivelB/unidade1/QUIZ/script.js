let currentQuestion = 1; // Começa na primeira pergunta
const totalQuestions = 10; // Total de perguntas
let utterance; // Variável global para o objeto SpeechSynthesisUtterance

function loadQuestion(questionNumber) {
    fetch(`pergunta${questionNumber}.txt`)
        .then(response => response.text())
        .then(question => {
            document.getElementById('questionContainer').textContent = question;
        })
        .catch(error => console.error('Erro ao carregar a pergunta:', error));
}

function loadOptions(questionNumber) {
    fetch(`respostas${questionNumber}.txt`)
        .then(response => response.text())
        .then(text => {
            const options = text.split('\n').slice(0, 4); // Limita a 4 opções
            const optionsContainer = document.getElementById('optionsContainer');
            optionsContainer.innerHTML = '';
            options.forEach((option, index) => {
                const button = document.createElement('div');
                button.className = 'option';
                button.textContent = `(${String.fromCharCode(65 + index)}) ${option}`; // Corrige o formato das letras
                button.addEventListener('click', () => checkAnswer(String.fromCharCode(65 + index), questionNumber));
                optionsContainer.appendChild(button);
            });
        })
        .catch(error => console.error('Erro ao carregar as respostas:', error));
}

function loadAnswerKey(questionNumber) {
    return fetch(`gabarito${questionNumber}.json`)
        .then(response => response.json())
        .then(data => data.correctAnswer)
        .catch(error => console.error('Erro ao carregar o gabarito:', error));
}

function loadCompleteText(questionNumber) {
    fetch(`pergunta${questionNumber}.txt`)
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

function checkAnswer(selectedAnswer, questionNumber) {
    loadAnswerKey(questionNumber).then(correctAnswer => {
        const feedbackContainer = document.getElementById('feedbackContainer');
        const feedbackGif = document.getElementById('feedbackGif');
        const feedbackSound = document.getElementById('feedbackSound');

        if (selectedAnswer === correctAnswer) {
            feedbackGif.src = 'certo.gif'; // Certifique-se de que o caminho está correto
            feedbackSound.src = 'certo.mp3'; // Verifique também o caminho do áudio
            feedbackSound.play();

            feedbackContainer.classList.remove('hidden');

            setTimeout(() => {
                feedbackContainer.classList.add('hidden');
                if (currentQuestion < totalQuestions) {
                    currentQuestion++;
                    loadQuestion(currentQuestion);
                    loadOptions(currentQuestion);
                    if (utterance) {
                        speechSynthesis.cancel(); // Interrompe a leitura ao mudar de pergunta
                    }
                }
            }, 3000); // Tempo para mostrar feedback
        } else {
            feedbackGif.src = 'errado.gif'; // Certifique-se de que o caminho está correto
            feedbackSound.src = 'errado.mp3'; // Verifique também o caminho do áudio
            feedbackSound.play();

            feedbackContainer.classList.remove('hidden');

            setTimeout(() => {
                feedbackContainer.classList.add('hidden');
                // Recarrega a mesma pergunta
                loadQuestion(currentQuestion);
                loadOptions(currentQuestion);
            }, 3000); // Tempo para mostrar feedback
        }
    });
}

function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); // Define o tamanho do PDF como A4

    doc.setFontSize(16);
    doc.text('HannahQuiz', 105, 10, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Name:__________________________________________________', 10, 30);
    doc.text('Date:________________', 10, 40);

    let y = 60;
    const lineHeight = 10;
    const maxHeight = 280; // Altura máxima para evitar ultrapassar o limite da página

    function addQuestionAndOptions(i) {
        if (i > totalQuestions) {
            doc.save('HannahQuiz.pdf');
            return;
        }

        fetch(`pergunta${i}.txt`)
            .then(response => response.text())
            .then(question => {
                fetch(`respostas${i}.txt`)
                    .then(response => response.text())
                    .then(text => {
                        const options = text.split('\n').slice(0, 4);
                        doc.setFontSize(12);

                        // Adiciona nova página se necessário
                        if (y + lineHeight * (options.length + 2) > maxHeight) {
                            doc.addPage();
                            y = 20; // Resetar a posição y para a nova página
                        }

                        doc.text(`Question ${i}: ${question}`, 10, y);
                        y += lineHeight;

                        options.forEach((option, index) => {
                            doc.text(`(${String.fromCharCode(65 + index)}) ${option}`, 10, y);
                            y += lineHeight;
                        });

                        y += lineHeight; // Espaço extra após cada pergunta

                        addQuestionAndOptions(i + 1); // Processa a próxima pergunta
                    });
            });
    }

    addQuestionAndOptions(1);
}

document.getElementById('readButton').addEventListener('click', () => {
    loadCompleteText(currentQuestion);
});

document.getElementById('previousButton').addEventListener('click', () => {
    if (currentQuestion > 1) {
        currentQuestion--;
        loadQuestion(currentQuestion);
        loadOptions(currentQuestion);
        if (utterance) {
            speechSynthesis.cancel(); // Interrompe a leitura ao mudar de pergunta
        }
    }
});

document.getElementById('nextButton').addEventListener('click', () => {
    if (currentQuestion < totalQuestions) {
        currentQuestion++;
        loadQuestion(currentQuestion);
        loadOptions(currentQuestion);
        if (utterance) {
            speechSynthesis.cancel(); // Interrompe a leitura ao mudar de pergunta
        }
    }
});

document.getElementById('downloadPdfButton').addEventListener('click', generatePDF);

// Carrega a primeira pergunta ao iniciar
loadQuestion(currentQuestion);
loadOptions(currentQuestion);
