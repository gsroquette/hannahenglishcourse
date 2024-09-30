document.addEventListener('DOMContentLoaded',function(){
    const activities=[
        {id:1,name:"StoryCards",path:"../unidade2/StoryCards/index.html",img:"../../imagens/botoes/storycards_button.png"},
        {id:2,name:"Flashcards",path:"../unidade2/Flashcards/index.html",img:"../../imagens/botoes/flashcards_button.png"},
        {id:3,name:"MemoryGame",path:"../unidade2/MemoryGame/index.html",img:"../../imagens/botoes/memorygame_button.png"},
        {id:4,name:"QUIZ",path:"../unidade2/QUIZ/index.html",img:"../../imagens/botoes/quiz_button.png"},
        {id:5,name:"WordSearch",path:"../unidade2/WordSearch/index.html",img:"../../imagens/botoes/wordsearch_button.png"}
    ];
    
    const mapContainer=document.getElementById('mapContainer');
    const svgContainer=document.getElementById('linesSvg');
    let currentPhase=0;
    let player;

    function createPlayer(){
        player=document.createElement('img');
        player.src='../../imagens/bonequinho.png';
        player.classList.add('player');
        mapContainer.appendChild(player);
        moveToPhase(currentPhase);
    }

    activities.forEach((activity,index)=>{
        const phaseDiv=document.createElement('div');
        phaseDiv.classList.add('phase');
        phaseDiv.style.top=`${10+index*15}%`;
        phaseDiv.style.left=`${10+index*10}%`;

        const phaseImage=document.createElement('img');
        phaseImage.src=activity.img;
        phaseImage.alt=activity.name;
        phaseImage.classList.add('phase-img');
        phaseDiv.appendChild(phaseImage);

        if(index===currentPhase){
            phaseDiv.classList.add('active');
        }else if(index>currentPhase){
            phaseDiv.classList.add('locked');
        }

        phaseDiv.addEventListener('click',()=>{
            if(!phaseDiv.classList.contains('locked')){
                window.location.href=activity.path;
                unlockNextPhase(index);
            }
        });

        mapContainer.appendChild(phaseDiv);
    });

    function moveToPhase(index){
        const phase=document.querySelectorAll('.phase')[index];
        const coords=phase.getBoundingClientRect();
        document.querySelectorAll('.phase').forEach(phase=>{phase.classList.remove('active');});
        phase.classList.add('active');
        player.style.top=`${coords.top+window.scrollY+coords.height/2}px`;
        player.style.left=`${coords.left+window.scrollX+coords.width/2}px`;
        player.classList.add('moving');
        const phaseInView=phase.getBoundingClientRect().top>=0&&phase.getBoundingClientRect().bottom<=window.innerHeight;
        if(!phaseInView){
            window.scrollTo({top:coords.top+window.scrollY-window.innerHeight/2,behavior:'smooth'});
        }
    }

    function unlockNextPhase(index){
        if(index<activities.length-1){
            const nextPhase=document.querySelectorAll('.phase')[index+1];
            nextPhase.classList.remove('locked');
            nextPhase.classList.add('unlocked');
        }
    }

    function drawLines(){
        svgContainer.innerHTML='';
        for(let i=0;i<activities.length-1;i++){
            const phase1=document.querySelectorAll('.phase')[i];
            const phase2=document.querySelectorAll('.phase')[i+1];
            const coords1=phase1.getBoundingClientRect();
            const coords2=phase2.getBoundingClientRect();
            const path=document.createElementNS('http://www.w3.org/2000/svg','path');
            const d=`M ${coords1.left+coords1.width/2} ${coords1.top+coords1.height/2} Q ${(coords1.left+coords2.left)/2} ${(coords1.top+coords2.top)/2}, ${coords2.left+coords2.width/2} ${coords2.top+coords2.height/2}`;
            path.setAttribute('d',d);
            path.setAttribute('stroke','black');
            path.setAttribute('stroke-dasharray','15,10');
            path.setAttribute('fill','transparent');
            path.setAttribute('stroke-width','6');
            svgContainer.appendChild(path);
        }
    }

    drawLines();
    createPlayer();
    window.addEventListener('resize',drawLines);
});
