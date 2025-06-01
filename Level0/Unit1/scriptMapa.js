document.addEventListener('DOMContentLoaded', function() {
  // ------------------------------
  // 1) Captura elementos da DOM
  // ------------------------------
  const database = firebase.database();
  const auth     = firebase.auth();
  const loginLink       = document.getElementById("loginLink");
  const loginContainer  = document.getElementById("loginContainer");
  const userDropdown    = document.getElementById("userDropdown");
  const levelUnitInfo   = document.getElementById("levelUnitInfo");
  const mapContainer    = document.getElementById("mapContainer");
  const svgContainer    = document.getElementById("linesSvg");
  let player;
  let lastUnlockedIndex = -1;

  // ------------------------------
  // 2) Lê parâmetros da URL
  //    - activity (ex: “grammar”)
  //    - level (ex: “Level1”)
  //    - unit  (ex: “Unit2”)
  // ------------------------------
  const params = new URLSearchParams(window.location.search);
  const activityType = params.get('activity') || '';
  const currentLevel = params.get('level') || '';
  const currentUnit  = params.get('unit')  || '';

  // Atualiza texto “Level / Unit” no topo:
  levelUnitInfo.innerHTML = `${currentLevel}<br>${currentUnit}`;

  // Localiza a lista de fases para esta “atividade”
  const fasesList = (fasesConfig[activityType] || []);

  // Constrói o array “activities” no mesmo formato que os scripts originais:
  const activities = fasesList.map((fase, idx) => ({
    id: idx + 1,
    name: fase.name,
    path: `/Atividades/${encodeURIComponent(fase.path)}/index.html?level=${currentLevel}&unit=${currentUnit}&fase=${idx + 1}`,
    img: `../../imagens/botoes/${fase.img}`,
    unlocked: false
  }));

  // ------------------------------
  // 3) Fecha dropdown ao clicar fora
  // ------------------------------
  document.addEventListener("click", function(event) {
    if (!userDropdown.contains(event.target) && !loginContainer.contains(event.target)) {
      userDropdown.style.display = 'none';
    }
  });

  // ------------------------------
  // 4) Autenticação Firebase
  //  - Exibe avatar/nome e dropdown conforme role
  //  - Em seguida, carrega progresso
  // ------------------------------
  auth.onAuthStateChanged(user => {
    if (user) {
      const userId = user.uid;
      database.ref('/usuarios/' + userId).once('value').then(snapshot => {
        const userData = snapshot.val();
        const userName   = userData.nome || user.email;
        const userAvatar = userData.avatar ? `../../imagens/${userData.avatar}` : '../../imagens/bonequinho.png';

        // Atualiza loginLink: avatar + nome
        loginLink.innerHTML = `<img src="${userAvatar}" alt="User Icon" class="user-icon">` +
                              `<p class="user-name">${userName}</p>`;
        loginLink.removeAttribute('href');

        // Monta link para dashboard conforme role
        let dashboardLink = '';
        if (userData.role === 'proprietario' || userData.role === 'professor') {
          dashboardLink = userData.role === 'proprietario'
            ? '<a href="../../painel_proprietario.html" class="dropdown-item">OWNER DASHBOARD</a>'
            : '<a href="../../painel_professor.html" class="dropdown-item">TEACHER DASHBOARD</a>';
        } else if (userData.role === 'aluno') {
          dashboardLink = '<a href="../../painel_aluno.html" class="dropdown-item">STUDENT DASHBOARD</a>';
        }

        userDropdown.innerHTML = `
          ${dashboardLink}
          <a href="/index.html"                            class="dropdown-item">SELECT A NEW LEVEL</a>
          <a href="/${currentLevel}/index.html"             class="dropdown-item">SELECT A NEW UNIT</a>
          <a href="/${currentLevel}/${currentUnit}/index.html" class="dropdown-item">SELECT A NEW ACTIVITY</a>
        `;

        // Toggle dropdown ao clicar em container (exceto em <a>)
        loginContainer.addEventListener("click", function(ev) {
          if (ev.target.tagName !== 'A') {
            userDropdown.style.display = userDropdown.style.display === 'flex' ? 'none' : 'flex';
          }
        });

        // Carrega progresso (chama initializeMap depois)
        loadUserProgress(userId, userAvatar, userData.role);
      }).catch(err => {
        console.error("Erro ao carregar dados do usuário:", err);
      });
    } else {
      loginLink.setAttribute('href', 'Formulario/login.html');
    }
  });

  // ------------------------------
  // 5) Carrega progresso do Firebase
  // ------------------------------
  function loadUserProgress(userId, userAvatar, userRole) {
    const progressPath = `/usuarios/${userId}/progresso/${currentLevel}/${currentUnit}`;
    if (userRole === 'proprietario' || userRole === 'professor') {
      activities.forEach(a => a.unlocked = true);
      lastUnlockedIndex = activities.length - 1;
      initializeMap(userAvatar);
    } else {
      database.ref(progressPath).once('value').then(snapshot => {
        const progress = snapshot.val() || {};
        activities.forEach((activity, idx) => {
          // procura chave “fase<ID>” no objeto
          const faseKey = Object.keys(progress).find(key => 
            key.includes(`fase${activity.id}`) || key.includes(activity.id.toString())
          );
          if (faseKey && progress[faseKey] === true) {
            activity.unlocked = (idx === 0) || activities[idx-1].unlocked;
            if (activity.unlocked) lastUnlockedIndex = idx;
          }
        });
        initializeMap(userAvatar);
      }).catch(err => {
        console.error("Erro ao ler progresso no Firebase:", err);
        initializeMap(userAvatar);
      });
    }
  }

  // ------------------------------
  // 6) Inicializa mapa (posiciona fases, jogador e linhas)
  // ------------------------------
  function initializeMap(userAvatar) {
    window.scrollTo(0, 0);

    // Remove fases antigas
    document.querySelectorAll('.phase').forEach(el => el.remove());

    // Calcula “baseTopPosition” (altura do título + margem de 20px)
    const titleContainer = document.querySelector('.title-container');
    const titleBottom = titleContainer.offsetTop + titleContainer.offsetHeight;
    const baseTopPosition = titleBottom + 20;

    activities.forEach((activity, index) => {
      // Cria <div class="phase">
      const phaseDiv = document.createElement('div');
      phaseDiv.classList.add('phase');

      // Distância vertical: 20% em portrait, 30% em landscape
      const isLandscape = window.innerWidth > window.innerHeight;
      const spacingPercent = isLandscape ? 30 : 20;
      const topPosition = baseTopPosition + index * (spacingPercent * window.innerHeight / 100);

      // Distância horizontal limitada a 400px do centro
      const maxOffset = 400; 
      const screenCenter = window.innerWidth / 2;
      const offset = Math.min(window.innerWidth * 0.4, maxOffset);
      const horizontalPositionPx = screenCenter + (index % 2 === 0 ? -offset : offset);

      phaseDiv.style.top  = `${topPosition}px`;
      phaseDiv.style.left = `${horizontalPositionPx}px`;

      // Insere imagem da fase
      const imgEl = document.createElement('img');
      imgEl.src = activity.img;
      imgEl.alt = activity.name;
      imgEl.classList.add('phase-img');
      phaseDiv.appendChild(imgEl);

      // Se estiver bloqueada, adiciona ícone de cadeado
      if (!activity.unlocked) {
        phaseDiv.classList.add('locked');
        const lockIcon = document.createElement('img');
        lockIcon.src = '../../imagens/lock_icon_resized.png';
        lockIcon.classList.add('lock-icon');
        phaseDiv.appendChild(lockIcon);
      } else {
        phaseDiv.classList.add('active');
      }

      // Ao clicar, se desbloqueada, redireciona
      phaseDiv.addEventListener('click', () => {
        if (activity.unlocked) {
          moveToPhase(index, activity.path);
        }
      });

      mapContainer.appendChild(phaseDiv);
    });

    // Desenha linhas entre fases
    drawLines();

    // Cria “player” (avatar) e posiciona
    createPlayer(userAvatar);

    // Anima desbloqueio + scroll para última fase desbloqueada
    if (lastUnlockedIndex >= 0) {
      const lastDiv = document.querySelectorAll('.phase')[lastUnlockedIndex];
      animateUnlock(lastDiv);
      scrollToPhase(lastUnlockedIndex);
    }
  }

  // ------------------------------
  // 7) Cria ou atualiza avatar do jogador
  // ------------------------------
  function createPlayer(avatarPath) {
    if (!player) {
      player = document.createElement('img');
      player.classList.add('player');
      mapContainer.appendChild(player);
    }
    player.src = avatarPath;
    moveToPhase(lastUnlockedIndex > 0 ? lastUnlockedIndex - 1 : 0);
  }

  // ------------------------------
  // 8) Move avatar para a fase clicada (ou inicial)
  // ------------------------------
  function moveToPhase(index, path = null) {
    const phase = document.querySelectorAll('.phase')[index];
    if (!phase) return;
    const coords = phase.getBoundingClientRect();
    player.style.top  = `${coords.top + window.scrollY + coords.height / 2}px`;
    player.style.left = `${coords.left + window.scrollX + coords.width / 2}px`;
    if (path) {
      setTimeout(() => window.location.href = path, 600);
    }
  }

  // ------------------------------
  // 9) Desenha curvas SVG entre fases
  // ------------------------------
  function drawLines() {
    svgContainer.innerHTML = '';
    const phases = document.querySelectorAll('.phase');
    for (let i = 0; i < activities.length - 1; i++) {
      const p1 = phases[i], p2 = phases[i+1];
      if (!p1 || !p2) continue;
      const c1 = p1.getBoundingClientRect();
      const c2 = p2.getBoundingClientRect();
      const cpX1 = c1.left + (c2.left - c1.left) * 0.33;
      const cpY1 = c1.top  + (c2.top  - c1.top ) * 0.33 + 150;
      const cpX2 = c1.left + (c2.left - c1.left) * 0.66;
      const cpY2 = c2.top  - 150;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${c1.left + c1.width/2} ${c1.top + c1.height/2}
                 C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, 
                   ${c2.left + c2.width/2} ${c2.top + c2.height/2}`;
      path.setAttribute('d', d);
      path.setAttribute('class', 'path path-blue');
      svgContainer.appendChild(path);
    }
  }

  // ------------------------------
  // 10) Anima desbloqueio (gif + som)
  // ------------------------------
  function animateUnlock(phaseDiv) {
    const unlockGif = document.createElement('img');
    unlockGif.src = '../../imagens/cadeado.gif';
    unlockGif.classList.add('unlock-gif');
    phaseDiv.appendChild(unlockGif);
    const unlockSound = new Audio('../../imagens/unlock-padlock.mp3');
    unlockSound.play();
    setTimeout(() => unlockGif.remove(), 3000);
  }

  // ------------------------------
  // 11) Scroll suave até a fase de índice dado
  // ------------------------------
  function scrollToPhase(index) {
    const phase = document.querySelectorAll('.phase')[index];
    if (!phase) return;
    const coords = phase.getBoundingClientRect();
    window.scrollTo({
      top: coords.top + window.scrollY - window.innerHeight/2,
      behavior: 'smooth'
    });
  }
});
