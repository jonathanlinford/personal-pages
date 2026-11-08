'use strict';
const $ = id => document.getElementById(id);
let sound = false, audioContext;
function chime() {
  if (!sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const t = audioContext.currentTime;
    [523.25, 659.25].forEach((f, i) => {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.frequency.value = f;
      gain.gain.setValueAtTime(0, t + i * .08);
      gain.gain.linearRampToValueAtTime(.045, t + i * .08 + .015);
      gain.gain.exponentialRampToValueAtTime(.001, t + i * .08 + .3);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(t + i * .08); oscillator.stop(t + i * .08 + .32);
    });
  } catch { /* Sound is optional. */ }
}
$('soundToggle').addEventListener('click', () => {
  sound = !sound;
  $('soundToggle').textContent = sound ? 'Sound on' : 'Sound off';
  $('soundToggle').setAttribute('aria-pressed', String(sound)); chime();
});
document.querySelectorAll('.quiz').forEach(quiz => {
  quiz.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    if (quiz.dataset.done) return;
    const right = button.dataset.correct === 'true';
    button.classList.add(right ? 'right' : 'wrong');
    quiz.querySelector('.feedback').textContent = right ? quiz.dataset.answer : 'Have another look. You can try again.';
    if (right) { quiz.dataset.done = 'true'; chime(); }
  }));
});
document.querySelectorAll('[data-reveal]').forEach(button => button.addEventListener('click', () => {
  if (button.getAttribute('aria-expanded') === 'true') return;
  button.setAttribute('aria-expanded', 'true');
  button.querySelector('span').textContent = button.dataset.reveal; chime();
}));
const bookAnswers = {
  bibleBook: 'Jesus is the Good Shepherd. He knows His sheep and speaks of other sheep who will hear His voice.',
  mormonBook: 'Jesus tells the Nephites they are the other sheep He spoke about. He loves and gathers His people.'
};
Object.entries(bookAnswers).forEach(([id, answer]) => $(id).addEventListener('click', () => {
  $(id).setAttribute('aria-expanded', 'true'); $(id).querySelector('.book-answer').textContent = answer; chime();
}));
$('joinBooks').addEventListener('click', () => {
  Object.keys(bookAnswers).forEach(id => { $(id).setAttribute('aria-expanded', 'true'); $(id).querySelector('.book-answer').textContent = bookAnswers[id]; });
  document.querySelector('.book-pair').classList.add('joined');
  $('bookFeedback').textContent = 'Two witnesses, one Savior: Jesus knows His people, loves them, and brings them to Him.'; chime();
});
let selected = { bible: null, mormon: null }, found = 0;
const matchButtons = [...document.querySelectorAll('#witnessMatch button')];
const truths = {
  love: 'Both books teach us to love others. What could that look like today?',
  prayer: 'Both books teach us to pray to Heavenly Father. When could you turn to Him?',
  shepherd: 'Both books teach that Jesus knows His sheep. We can listen to His voice.'
};
matchButtons.forEach(button => button.addEventListener('click', () => {
  const side = button.dataset.side;
  if (button.disabled) return;
  selected[side]?.setAttribute('aria-pressed', 'false');
  selected[side] = button; button.setAttribute('aria-pressed', 'true');
  if (!selected.bible || !selected.mormon) return;
  if (selected.bible.dataset.pair === selected.mormon.dataset.pair) {
    found++;
    const truth = truths[selected.bible.dataset.pair];
    [selected.bible, selected.mormon].forEach(x => { x.classList.add('matched'); x.disabled = true; x.setAttribute('aria-pressed', 'false'); x.setAttribute('aria-label', 'Matched: ' + x.innerText); });
    $('matchFeedback').textContent = found === 3 ? 'All three pairs found! Both books help us follow Jesus Christ.' : `${found} of 3 pairs found. ${truth}`;
    selected = { bible: null, mormon: null }; chime();
  } else {
    $('matchFeedback').textContent = 'These teach different truths. Try another card in either column.';
  }
}));
$('resetMatches').addEventListener('click', () => {
  selected = { bible: null, mormon: null }; found = 0;
  matchButtons.forEach(button => { button.disabled = false; button.classList.remove('matched'); button.setAttribute('aria-pressed', 'false'); button.removeAttribute('aria-label'); });
  $('matchFeedback').textContent = '0 of 3 pairs found. Which two teach the same truth?';
});
const riverStages = [
  { path: 'M117 155 C145 190 275 183 320 212 S450 270 490 340 L420 340 C390 280 340 260 300 238 S130 203 107 155Z', title: 'Diagram of a small stream flowing from the temple', caption: 'The water begins at the house of the Lord. · Verse 1', feedback: 'Find the temple in the picture. Where do the blessings begin?' },
  { path: 'M117 155 C150 190 275 170 340 205 S470 270 530 340 L390 340 C370 280 330 260 287 239 S125 203 107 155Z', title: 'Diagram of the stream growing as Ezekiel walks through ankle-deep water', caption: 'The water reaches Ezekiel’s ankles. · Verse 3', feedback: 'Point to your ankles. What happened to the water as Ezekiel went farther?' },
  { path: 'M117 155 C155 190 310 150 380 200 S510 260 600 340 L335 340 C330 280 310 270 260 245 S120 203 107 155Z', title: 'Diagram of the river widening and becoming too deep to walk across', caption: 'Knees, waist, then a river too deep to walk across. · Verses 4–5', feedback: 'Point to your knees, then your waist. Now imagine a whole river. How has the little stream changed?' },
  { path: 'M117 155 C155 190 310 150 380 200 S510 260 600 340 L335 340 C330 280 310 270 260 245 S120 203 107 155Z', title: 'Diagram of a wide river with fish and fruitful trees on its banks', caption: 'Fish fill the water. Trees bear fruit; their leaves bring healing. · Verses 9, 12', feedback: 'What new life can you spot? How do the Savior’s blessings bring hope to our hearts and families?' }
];
document.querySelectorAll('[data-river]').forEach(button => button.addEventListener('click', () => {
  const stage = riverStages[Number(button.dataset.river)];
  $('riverWater').setAttribute('d', stage.path);
  $('riverTitle').textContent = stage.title; $('riverCaption').textContent = stage.caption;
  $('riverFeedback').textContent = stage.feedback;
  $('riverLife').setAttribute('opacity', button.dataset.river === '3' ? '1' : '0');
  document.querySelectorAll('[data-river]').forEach(x => x.setAttribute('aria-pressed', String(x === button))); chime();
}));
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-prompt]').forEach(x => x.setAttribute('aria-pressed', String(x === button)));
  $('namePrompt').textContent = `${button.textContent}: “${button.dataset.prompt}”`;
}));
$('finish').addEventListener('click', () => {
  $('finish').textContent = 'One willing choice this week'; $('finish').disabled = true;
  $('finishFeedback').textContent = 'Jesus Christ loves you and can help you grow. Ask for His help, then practice one teaching.'; chime();
});
const lightbox = $('lightbox'); let previousFocus;
document.querySelectorAll('.picture').forEach(button => button.addEventListener('click', () => {
  previousFocus = button; const img = button.querySelector('img');
  $('lightboxImage').src = img.src; $('lightboxImage').alt = img.alt;
  $('lightboxCaption').textContent = button.closest('figure').querySelector('figcaption').innerText;
  lightbox.showModal(); document.body.style.overflow = 'hidden';
}));
$('lightboxClose').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('close', () => { document.body.style.overflow = ''; $('lightboxImage').removeAttribute('src'); previousFocus?.focus({ preventScroll: true }); });
const nav = [...document.querySelectorAll('.path a')], sections = nav.map(a => document.querySelector(a.getAttribute('href')));
function mark() {
  let active = 0; sections.forEach((section, i) => { if (section.getBoundingClientRect().top < innerHeight * .45) active = i; });
  nav.forEach((a, i) => { a.classList.toggle('active', i === active); if (i === active) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
}
addEventListener('scroll', mark, { passive: true }); mark();
const detailsStates = new Map();
function preparePrint() {
  document.querySelectorAll('details').forEach(d => { if (!detailsStates.has(d)) detailsStates.set(d, d.open); d.open = true; });
  document.querySelectorAll('[data-reveal]').forEach(b => {
    if (!b.querySelector('.print-answer')) { const answer = document.createElement('p'); answer.className = 'print-answer'; answer.textContent = b.dataset.reveal; b.append(answer); }
  });
  Object.entries(bookAnswers).forEach(([id, text]) => { if (!$(id).querySelector('.print-answer')) { const p = document.createElement('p'); p.className = 'print-answer'; p.textContent = text; $(id).append(p); } });
  document.querySelectorAll('.quiz').forEach(q => { if (!q.querySelector('.print-answer')) { const p = document.createElement('p'); p.className = 'print-answer'; p.textContent = q.dataset.answer; q.append(p); } });
}
addEventListener('beforeprint', preparePrint);
addEventListener('afterprint', () => { detailsStates.forEach((open, d) => { d.open = open; }); detailsStates.clear(); });
$('printLesson').addEventListener('click', () => { preparePrint(); window.print(); });
