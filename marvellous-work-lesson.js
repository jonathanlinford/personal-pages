'use strict';
const $=id=>document.getElementById(id);
let sound=false,audioContext;
function chime(){if(!sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const t=audioContext.currentTime;[523.25,659.25].forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t+i*.08);g.gain.linearRampToValueAtTime(.045,t+i*.08+.015);g.gain.exponentialRampToValueAtTime(.001,t+i*.08+.3);o.connect(g);g.connect(audioContext.destination);o.start(t+i*.08);o.stop(t+i*.08+.32)})}catch{/* Sound is optional. */}}

$('soundToggle').addEventListener('click',()=>{sound=!sound;$('soundToggle').textContent=sound?'Sound on':'Sound off';$('soundToggle').setAttribute('aria-pressed',String(sound));chime()});

document.querySelectorAll('.quiz').forEach(quiz=>{quiz.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{if(quiz.dataset.done)return;const right=button.dataset.correct==='true';button.classList.add(right?'right':'wrong');quiz.querySelector('.feedback').textContent=right?quiz.dataset.answer:'Try again. Think about Isaiah’s exact picture.';if(right){quiz.dataset.done='true';chime()}}))});

document.querySelectorAll('[data-refuge]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-refuge]').forEach(x=>x.classList.toggle('chosen',x===button));$('refugeFeedback').textContent=button.dataset.refuge;chime()}));

$('wipeTears').addEventListener('click',()=>{const wiped=$('tearFace').classList.toggle('wiped');$('tearFace').textContent=wiped?'🙂':'😢';$('tearFace').setAttribute('aria-label',wiped?'A peaceful face':'A crying face');$('wipeTears').textContent=wiped?'Show the promise again':'Wipe away the tears';$('tearFeedback').textContent=wiped?'No. Sadness is real—but because Jesus rose again, death and separation will not last forever.':'Ask first: Does this verse mean we never feel sad?';if(wiped)chime()});

document.querySelectorAll('[data-object]').forEach(button=>button.addEventListener('click',()=>{button.classList.add('revealed');button.querySelector('.reveal').textContent=button.dataset.object;$('objectFeedback').textContent=button.dataset.object;chime()}));

document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-prompt]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));$('namePrompt').textContent=button.textContent+': “'+button.dataset.prompt+'”'}));

$('finish').addEventListener('click',()=>{$('finish').textContent='I will notice';$('finish').disabled=true;$('finishFeedback').textContent='When you see even a small sign of healing, truth, or hope, thank Heavenly Father for His marvellous work.';chime()});

const lightbox=$('lightbox');let previousFocus;
document.querySelectorAll('.picture').forEach(button=>button.addEventListener('click',()=>{previousFocus=button;const img=button.querySelector('img');$('lightboxImage').src=img.src;$('lightboxImage').alt=img.alt;$('lightboxCaption').textContent=button.closest('figure').querySelector('figcaption').innerText.replace(/\n+/g,' — ');lightbox.showModal();document.body.style.overflow='hidden'}));
$('lightboxClose').addEventListener('click',()=>lightbox.close());
lightbox.addEventListener('click',event=>{if(event.target===lightbox)lightbox.close()});
lightbox.addEventListener('close',()=>{document.body.style.overflow='';$('lightboxImage').removeAttribute('src');previousFocus?.focus({preventScroll:true})});

const nav=[...document.querySelectorAll('.path a')],sections=nav.map(a=>document.querySelector(a.getAttribute('href')));
function mark(){let active=0;sections.forEach((section,index)=>{if(section.getBoundingClientRect().top<innerHeight*.45)active=index});nav.forEach((a,index)=>{a.classList.toggle('active',index===active);if(index===active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current')})}
addEventListener('scroll',mark,{passive:true});mark();

// Storm Sweeper: a lesson-themed, touch-friendly Minesweeper game.
const SWEEP_SIZE=8,SWEEP_STORMS=10;
const sweepGrid=$('sweeperGrid'),sweepStatus=$('sweeperStatus'),sweepFlag=$('sweeperFlag');
let sweepBoard=[],sweepStarted=false,sweepOver=false,sweepFlagMode=false;
const sweepNeighbors=index=>{const row=Math.floor(index/SWEEP_SIZE),col=index%SWEEP_SIZE,result=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const r=row+dr,c=col+dc;if((dr||dc)&&r>=0&&r<SWEEP_SIZE&&c>=0&&c<SWEEP_SIZE)result.push(r*SWEEP_SIZE+c)}return result};

function sweepLabel(cell,index){const place=`Row ${Math.floor(index/SWEEP_SIZE)+1}, column ${index%SWEEP_SIZE+1}`;if(cell.flagged)return `${place}, flagged`;if(!cell.revealed)return `${place}, covered`;if(cell.mine)return `${place}, storm cloud`;return cell.near?`${place}, ${cell.near} nearby storm ${cell.near===1?'cloud':'clouds'}`:`${place}, clear ground`}
function renderSweep(){
  const flags=sweepBoard.filter(cell=>cell.flagged).length;
  sweepBoard.forEach((cell,index)=>{const button=sweepGrid.children[index];button.className='sweep-cell';button.textContent='';if(cell.flagged&&!cell.revealed){button.classList.add('flagged');button.textContent='🚩'}else if(cell.revealed){button.classList.add('revealed');if(cell.mine){button.classList.add('storm');button.textContent='🌩️'}else if(cell.near){button.classList.add(`n${Math.min(cell.near,4)}`);button.textContent=cell.near}else button.textContent='🌼'}button.setAttribute('aria-label',sweepLabel(cell,index));button.disabled=sweepOver});
  if(!sweepOver&&sweepStarted)sweepStatus.textContent=`${SWEEP_STORMS-flags} storm ${SWEEP_STORMS-flags===1?'flag':'flags'} left`;
}
function plantStorms(first){
  const safe=new Set([first,...sweepNeighbors(first)]),spots=[...sweepBoard.keys()].filter(index=>!safe.has(index));
  for(let i=spots.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[spots[i],spots[j]]=[spots[j],spots[i]]}
  spots.slice(0,SWEEP_STORMS).forEach(index=>{sweepBoard[index].mine=true});
  sweepBoard.forEach((cell,index)=>{cell.near=sweepNeighbors(index).filter(next=>sweepBoard[next].mine).length});
  sweepStarted=true;
}
function openSweep(start){
  if(sweepOver||sweepBoard[start].flagged||sweepBoard[start].revealed)return;
  if(!sweepStarted)plantStorms(start);
  if(sweepBoard[start].mine){sweepBoard[start].revealed=true;sweepBoard.forEach(cell=>{if(cell.mine)cell.revealed=true});sweepOver=true;sweepStatus.textContent='A storm cloud! Try a new garden.';renderSweep();return}
  const queue=[start],seen=new Set();while(queue.length){const index=queue.shift();if(seen.has(index))continue;seen.add(index);const cell=sweepBoard[index];if(cell.flagged||cell.mine)continue;cell.revealed=true;if(cell.near===0)sweepNeighbors(index).forEach(next=>{if(!seen.has(next))queue.push(next)})}
  if(sweepBoard.filter(cell=>cell.revealed&&!cell.mine).length===SWEEP_SIZE*SWEEP_SIZE-SWEEP_STORMS){sweepOver=true;sweepBoard.forEach(cell=>{if(cell.mine)cell.flagged=true});sweepStatus.textContent='The wilderness is blossoming! You found every safe place.';chime()}
  renderSweep();
}
function flagSweep(index){if(sweepOver||sweepBoard[index].revealed)return;const flags=sweepBoard.filter(cell=>cell.flagged).length;if(!sweepBoard[index].flagged&&flags>=SWEEP_STORMS){sweepStatus.textContent=`You have placed all ${SWEEP_STORMS} flags.`;return}sweepBoard[index].flagged=!sweepBoard[index].flagged;renderSweep()}
function resetSweep(){
  sweepBoard=Array.from({length:SWEEP_SIZE*SWEEP_SIZE},()=>({mine:false,near:0,revealed:false,flagged:false}));sweepStarted=false;sweepOver=false;sweepFlagMode=false;sweepFlag.setAttribute('aria-pressed','false');sweepFlag.textContent='🚩 Flag mode: off';sweepStatus.textContent='Choose a square to begin.';sweepGrid.replaceChildren();
  sweepBoard.forEach((cell,index)=>{const button=document.createElement('button');button.type='button';button.className='sweep-cell';button.dataset.index=index;button.setAttribute('aria-label',sweepLabel(cell,index));button.addEventListener('click',()=>sweepFlagMode?flagSweep(index):openSweep(index));button.addEventListener('contextmenu',event=>{event.preventDefault();flagSweep(index)});sweepGrid.append(button)});
}
sweepFlag.addEventListener('click',()=>{sweepFlagMode=!sweepFlagMode;sweepFlag.setAttribute('aria-pressed',String(sweepFlagMode));sweepFlag.textContent=`🚩 Flag mode: ${sweepFlagMode?'on':'off'}`});
$('sweeperReset').addEventListener('click',resetSweep);
resetSweep();
