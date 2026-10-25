'use strict';
const $=id=>document.getElementById(id);
let sound=false,audioContext;
function chime(){if(!sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const t=audioContext.currentTime;[523.25,659.25].forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t+i*.08);g.gain.linearRampToValueAtTime(.045,t+i*.08+.015);g.gain.exponentialRampToValueAtTime(.001,t+i*.08+.3);o.connect(g);g.connect(audioContext.destination);o.start(t+i*.08);o.stop(t+i*.08+.32)})}catch{/* Sound is optional. */}}

$('soundToggle').addEventListener('click',()=>{sound=!sound;$('soundToggle').textContent=sound?'Sound on':'Sound off';$('soundToggle').setAttribute('aria-pressed',String(sound));chime()});

document.querySelectorAll('.quiz').forEach(quiz=>{quiz.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{if(quiz.dataset.done)return;const right=button.dataset.correct==='true';button.classList.add(right?'right':'wrong');quiz.querySelector('.feedback').textContent=right?quiz.dataset.answer:'Try again.';if(right){quiz.dataset.done='true';chime()}}))});

document.querySelectorAll('[data-reveal]').forEach(button=>button.addEventListener('click',()=>{
  if(button.getAttribute('aria-expanded')==='true')return;
  button.setAttribute('aria-expanded','true');
  button.querySelector('span:last-child').textContent=button.dataset.reveal;
  if(button.classList.contains('fish'))$('gatherFeedback').textContent='A loving invitation leaves room for a real choice.';
  chime();
}));
const clayStages=[
  {path:'M80 186 Q65 150 101 138 Q91 98 132 112 Q158 78 183 117 Q226 99 228 140 Q260 157 236 187 Z',rim:0,title:'An uneven lump of clay on a pottery wheel',caption:'Uneven clay. The potter can keep working.',feedback:'What might the potter see that we cannot see yet?'},
  {path:'M104 188 Q81 165 95 133 L109 112 Q160 100 211 112 L225 133 Q239 165 216 188 Z',rim:1,title:'Clay being reshaped into an open bowl',caption:'The clay is taking shape. The potter works patiently.',feedback:'Our turn: listen, pray, repent, and try a new choice. Growth takes practice.'},
  {path:'M128 190 Q90 170 103 142 L116 111 Q160 105 204 111 L217 142 Q230 170 192 190 Z',rim:1,title:'A shaped clay vessel ready for use',caption:'A vessel with a purpose. A new way to serve.',feedback:'Imagine filling this vessel with water to share. How can what you are learning help somebody else?'}
];
document.querySelectorAll('[data-clay]').forEach(button=>button.addEventListener('click',()=>{
  const stage=clayStages[Number(button.dataset.clay)];
  $('clayShape').setAttribute('d',stage.path);$('clayRim').setAttribute('opacity',stage.rim);
  $('clayTitle').textContent=stage.title;$('clayCaption').textContent=stage.caption;$('clayFeedback').textContent=stage.feedback;
  document.querySelectorAll('[data-clay]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));chime();
}));

document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-prompt]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));$('namePrompt').textContent=button.textContent+': “'+button.dataset.prompt+'”'}));

$('finish').addEventListener('click',()=>{$('finish').textContent='Known. Helped. Still growing.';$('finish').disabled=true;$('finishFeedback').textContent='Heavenly Father knows you. Help one person feel loved, and let Jesus help you grow one small step at a time.';chime()});

const lightbox=$('lightbox');let previousFocus;
document.querySelectorAll('.picture').forEach(button=>button.addEventListener('click',()=>{previousFocus=button;const img=button.querySelector('img');$('lightboxImage').src=img.src;$('lightboxImage').alt=img.alt;$('lightboxCaption').textContent=button.closest('figure').querySelector('figcaption').innerText.replace(/\n+/g,' — ');lightbox.showModal();document.body.style.overflow='hidden'}));
$('lightboxClose').addEventListener('click',()=>lightbox.close());
lightbox.addEventListener('click',event=>{if(event.target===lightbox)lightbox.close()});
lightbox.addEventListener('close',()=>{document.body.style.overflow='';$('lightboxImage').removeAttribute('src');previousFocus?.focus({preventScroll:true})});

const nav=[...document.querySelectorAll('.path a')],sections=nav.map(a=>document.querySelector(a.getAttribute('href')));
function mark(){let active=0;sections.forEach((section,index)=>{if(section.getBoundingClientRect().top<innerHeight*.45)active=index});nav.forEach((a,index)=>{a.classList.toggle('active',index===active);if(index===active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current')})}
addEventListener('scroll',mark,{passive:true});mark();
