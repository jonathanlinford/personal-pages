'use strict';
const $=id=>document.getElementById(id);
let sound=false,audioContext;
function chime(){if(!sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const t=audioContext.currentTime;[523.25,659.25].forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t+i*.08);g.gain.linearRampToValueAtTime(.045,t+i*.08+.015);g.gain.exponentialRampToValueAtTime(.001,t+i*.08+.3);o.connect(g);g.connect(audioContext.destination);o.start(t+i*.08);o.stop(t+i*.08+.32)})}catch{/* Optional sound must never stop an activity. */}}
$('soundToggle').addEventListener('click',()=>{sound=!sound;$('soundToggle').textContent=sound?'Sound on':'Sound off';$('soundToggle').setAttribute('aria-pressed',String(sound));chime()});
document.querySelectorAll('.quiz').forEach(quiz=>{quiz.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{if(quiz.dataset.done)return;const right=button.dataset.correct==='true';button.classList.add(right?'right':'wrong');quiz.querySelector('.feedback').textContent=right?quiz.dataset.answer:'Think back to David’s words, then try again.';if(right){quiz.dataset.done='true';chime()}}))});
let clue=0;const clues=[...document.querySelectorAll('.clues li')];$('clueNext').addEventListener('click',()=>{if(clue<clues.length){clues[clue].hidden=false;clue++;$('clueNext').textContent=clue===3?'Say the name together':'Reveal the next clue'}else{$('clueAnswer').hidden=false;$('clueNext').disabled=true;$('clueNext').textContent='The promised Savior';chime()}});
document.querySelectorAll('.card-button').forEach(button=>button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));button.querySelector('.hint').hidden=!open;button.querySelector('.detail').hidden=open;if(!open)chime()}));
$('cleanReveal').addEventListener('click',()=>{const clean=$('cloth').classList.toggle('clean');$('cloth').textContent=clean?'White as snow':'Scarlet';$('cleanReveal').textContent=clean?'Show the picture again':'Reveal Isaiah’s promise';$('cleanFeedback').textContent=clean?'Jesus Christ can forgive us and help us become clean as we repent.':'First ask: “Is the Lord telling us to give up, or inviting us to come back?”';if(clean)chime()});
document.querySelectorAll('[data-repair]').forEach(b=>b.addEventListener('click',()=>{$('repairFeedback').textContent=b.dataset.repair;chime()}));
const callScenes=[['“I am a man of unclean lips.”','Isaiah sees the Lord and feels his own imperfections. He does not pretend he has none.'],['“Thine iniquity is taken away.”','A heavenly being touches Isaiah’s lips with a coal from the altar. In the vision this is a sign that his sin is cleansed. God helps him.'],['“Here am I; send me.”','The Lord asks whom He should send. Isaiah offers to go. First he receives help; then he offers himself in service.']];let callIndex=0;
function renderCall(){const scene=$('callScene');scene.replaceChildren();const n=document.createElement('span');n.className='scene-count';n.textContent=`${callIndex+1} / 3`;const h=document.createElement('strong');h.textContent=callScenes[callIndex][0];const p=document.createElement('p');p.textContent=callScenes[callIndex][1];scene.append(n,h,p);$('callNext').disabled=callIndex===2;$('callNext').textContent=callIndex===2?'Say it together: Here am I':'What happens next?'}
$('callNext').addEventListener('click',()=>{if(callIndex<2){callIndex++;renderCall();chime()}});$('callReset').addEventListener('click',()=>{callIndex=0;renderCall()});
const scenarios=[{title:'One seat. Two people.',text:'You and another child both want the same seat. What could you say?',choices:['“Move. I want that one.”','“Could we take turns? You can sit there first.”','“Fine. I won’t talk to you again.”'],good:1,explanation:'Taking turns gives both people a voice. Now try saying it in a calm voice.'},{title:'The team loses.',text:'Someone starts blaming one player for the whole game. What could you say?',choices:['“Let’s be kind. We all played. Want to practice together?”','“Yes, it was all your fault.”','“You can’t play next time.”'],good:0,explanation:'You can tell the truth about a hard game without shaming one person. Invite them to keep belonging.'},{title:'Someone is still angry.',text:'You apologized, but your friend still wants some space. What could you do?',choices:['Demand forgiveness immediately.','Tell everyone your friend is mean.','Give them time, keep your promise, and ask an adult for help if needed.'],good:2,explanation:'Making peace can take time. Keep doing your part. You can ask for help without forcing someone’s feelings.'}];let scenarioIndex=0;
function renderScenario(){const s=scenarios[scenarioIndex];$('scenarioTitle').textContent=s.title;$('scenarioText').textContent=s.text;$('scenarioFeedback').textContent='Talk together before choosing.';$('scenarioNext').disabled=true;$('scenarioNext').textContent=scenarioIndex===2?'Try the situations again':'Next situation';$('scenarioChoices').replaceChildren();s.choices.forEach((choice,i)=>{const b=document.createElement('button');b.type='button';b.className='scenario-choice';b.textContent=choice;b.addEventListener('click',()=>{if(i===s.good){b.classList.add('selected');$('scenarioChoices').querySelectorAll('button').forEach(x=>x.disabled=true);$('scenarioFeedback').textContent=s.explanation;$('scenarioNext').disabled=false;chime()}else{$('scenarioFeedback').textContent='Would that help both people feel heard and treated kindly? Try another response.'}});$('scenarioChoices').append(b)})}
$('scenarioNext').addEventListener('click',()=>{scenarioIndex=(scenarioIndex+1)%scenarios.length;renderScenario()});renderScenario();
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-prompt]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('namePrompt').textContent=b.textContent+': “'+b.dataset.prompt+'”'}));
$('finish').addEventListener('click',()=>{$('finish').textContent='Ready to try';$('finish').disabled=true;$('finishFeedback').textContent='Remember that person when you get home. One small act of kindness is a good beginning.';chime()});
const lightbox=$('lightbox');let previousFocus;
document.querySelectorAll('.picture').forEach(button=>button.addEventListener('click',()=>{previousFocus=button;const img=button.querySelector('img');$('lightboxImage').src=img.src;$('lightboxImage').alt=img.alt;$('lightboxCaption').textContent=button.closest('figure').querySelector('figcaption').innerText.replace(/\n+/g, ' — ');lightbox.showModal();document.body.style.overflow='hidden'}));
$('lightboxClose').addEventListener('click',()=>lightbox.close());lightbox.addEventListener('click',e=>{if(e.target===lightbox)lightbox.close()});lightbox.addEventListener('close',()=>{document.body.style.overflow='';$('lightboxImage').removeAttribute('src');previousFocus?.focus({preventScroll:true})});
const nav=[...document.querySelectorAll('.path a')],sections=nav.map(a=>document.querySelector(a.getAttribute('href')));function mark(){let active=0;sections.forEach((s,i)=>{if(s.getBoundingClientRect().top<innerHeight*.45)active=i});nav.forEach((a,i)=>{a.classList.toggle('active',i===active);if(i===active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current')})}addEventListener('scroll',mark,{passive:true});mark();
const pairs=[
 ['Counsellor','Jesus guides me','guidance'],
 ['Prince of Peace','Jesus helps me make peace','peace'],
 ['Immanuel','God with us','immanuel'],
 ['White as snow','Jesus can make me clean','clean'],
 ['Here am I','I am willing to serve','serve'],
 ['The Lord’s house','Learn His ways in the temple','temple'],
 ['A child is born','Isaiah promised a Savior','immanuel'],
 ['Learn to do well','Practice doing good','serve'],
 ['Cease to do evil','Stop doing wrong','clean'],
 ['Walk in His paths','Follow what God teaches','guidance'],
 ['God is my salvation','The Lord can save me','immanuel'],
 ['I will trust','Rely on the Lord','guidance'],
 ['Make room for someone','Help others feel included','peace'],
 ['Tell the truth','Be honest about a mistake','clean'],
 ['Repair what you can','Help make things right','serve'],
 ['Choose differently','Change a wrong habit','clean'],
 ['Take turns','Let others have a chance','peace'],
 ['He will teach us','God helps us learn His ways','temple']
];
let deck=[],picked=[],locked=false,matched=0,turns=0,hideTimer,boardSize=4,pairCount=8;
const bestKey='isaiah-matching-best-v1';
let bestScores={};
try{const saved=JSON.parse(localStorage.getItem(bestKey)||'{}');for(const size of [4,5,6]){const n=saved?.[size];if(Number.isInteger(n)&&n>=Math.floor(size*size/2))bestScores[size]=n}}catch{/* Scores still work for this visit when storage is unavailable. */}
function updateStats(){$('gameStats').textContent=`Pairs ${matched} / ${pairCount} · Turns ${turns}`;$('gameBest').textContent=`Best ${boardSize}×${boardSize}: ${bestScores[boardSize]===undefined?'—':bestScores[boardSize]+' turns'}`}
function announceFinish(){
 const previous=bestScores[boardSize],isRecord=previous===undefined||turns<previous;
 const banner=$('gameRecord');banner.hidden=false;banner.classList.toggle('new-record',isRecord);
 if(isRecord){bestScores[boardSize]=turns;let saved=true;try{localStorage.setItem(bestKey,JSON.stringify(bestScores))}catch{saved=false}
 banner.textContent=`★ New best score! ${boardSize}×${boardSize} in ${turns} turns.`+(previous===undefined?' Your first completed score!':` You beat ${previous} turns!`)+(saved?'':' Saved for this visit only.');
 }else if(turns===previous){banner.textContent=`You tied your best! ${boardSize}×${boardSize} in ${turns} turns.`}
 else{banner.textContent=`Board complete in ${turns} turns. Your ${boardSize}×${boardSize} best is ${previous} turns. Try again!`}
 $('gameFeedback').textContent='All pairs found! Which idea will you remember this week?';
}

function turnCard(index,show){
 const b=$('gameGrid').children[index],card=deck[index];
 b.classList.toggle('flipped',show);b.setAttribute('aria-pressed',String(show));
 b.setAttribute('aria-label',show?card.text:`Card ${index+1}, face down`);b.replaceChildren();
 if(show){const img=document.createElement('img');img.src='assets/isaiah-matching/'+pairs[card.pair][2]+'.svg';img.alt='';img.width=160;img.height=160;const label=document.createElement('span');label.className='game-phrase';label.textContent=card.text;b.append(img,label)}
 else{const back=document.createElement('span');back.className='back';back.textContent='?';back.setAttribute('aria-hidden','true');b.append(back)}
}
function pick(index){
 const b=$('gameGrid').children[index];if(locked||b.disabled||picked.includes(index))return;
 turnCard(index,true);picked.push(index);if(picked.length<2){$('gameFeedback').textContent='Choose a second card.';return}
 turns++;const [a,c]=picked;
 if(deck[a].pair===deck[c].pair){matched++;for(const n of picked){const x=$('gameGrid').children[n];x.classList.add('matched');x.disabled=true}picked=[];chime();$('gameFeedback').textContent=matched===pairCount?'All pairs found! Which idea will you remember this week?':'A match! Explain how those two ideas belong together.'}
 else{locked=true;$('gameFeedback').textContent='Different pairs. Remember where they are and try again.';hideTimer=setTimeout(()=>{picked.forEach(n=>turnCard(n,false));picked=[];locked=false},1500)}if(matched===pairCount)announceFinish();updateStats()
}
function resetGame(){
 clearTimeout(hideTimer);$('gameRecord').hidden=true;$('gameRecord').textContent='';picked=[];locked=false;matched=0;turns=0;pairCount=Math.floor(boardSize*boardSize/2);
 deck=pairs.slice(0,pairCount).flatMap((pair,i)=>pair.slice(0,2).map(text=>({pair:i,text})));
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
 if(boardSize===5)deck.splice(12,0,{free:true});
 const grid=$('gameGrid');grid.style.setProperty('--board-size',boardSize);grid.replaceChildren();
 deck.forEach((card,i)=>{const b=document.createElement('button');b.type='button';b.className='game-tile';grid.append(b);if(card.free){b.classList.add('free');b.disabled=true;b.textContent='★ Free space';b.setAttribute('aria-label','Free center space')}else{b.addEventListener('click',()=>pick(i));turnCard(i,false)}});
 document.querySelectorAll('[data-board-size]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.boardSize)===boardSize)));
 updateStats();$('gameFeedback').textContent=boardSize===5?'Turn over two cards. The center is a free space.':'Turn over two cards.';
 $('gameScroll').scrollLeft=0;
}
document.querySelectorAll('[data-board-size]').forEach(b=>b.addEventListener('click',()=>{boardSize=Number(b.dataset.boardSize);resetGame()}));
$('gameReset').addEventListener('click',resetGame);resetGame();
