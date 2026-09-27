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
