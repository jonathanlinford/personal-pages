'use strict';

const $ = id => document.getElementById(id);

const gospelPairs = [
  {name:'Jesus Christ', meaning:'Our Savior and the center of the gospel', icon:'✦'},
  {name:'Faith in Jesus Christ', meaning:'Trust Him enough to follow Him', icon:'⚓'},
  {name:'Repentance', meaning:'Turn to Christ and choose to change', icon:'↩'},
  {name:'Baptism', meaning:'Make our first covenant with God', icon:'💧'},
  {name:'Gift of the Holy Ghost', meaning:'Receive comfort, guidance, and truth', icon:'🔥'},
  {name:'Prayer', meaning:'Speak with Heavenly Father', icon:'🙏'},
  {name:'Scriptures', meaning:'Study the word of God', icon:'📖'},
  {name:'Sacrament', meaning:'Remember Jesus and renew our covenants', icon:'🍞'},
  {name:'Temple', meaning:'Make sacred covenants and unite families', icon:'🏛'},
  {name:'Living prophet', meaning:'Hear guidance God gives for our day', icon:'📣'},
  {name:'Service', meaning:'Follow Jesus by helping someone', icon:'🤝'},
  {name:'Tithing', meaning:'Give one tenth to the Lord', icon:'⑩'},
  {name:'Sabbath day', meaning:'Worship God and rest from ordinary work', icon:'☀'},
  {name:'Word of Wisdom', meaning:'Care for our bodies and avoid harmful things', icon:'🌿'},
  {name:'Missionary work', meaning:'Invite others to come unto Christ', icon:'🌍'},
  {name:'Priesthood', meaning:'God’s authority to bless and serve', icon:'🔑'},
  {name:'Eternal families', meaning:'Family relationships can continue forever', icon:'♥'},
  {name:'Covenant path', meaning:'Keep making and honoring promises with God', icon:'👣'}
];

let soundOn = false;
let audioContext;
let boardSize = 4;
let pairCount = 8;
let deck = [];
let selected = [];
let locked = false;
let matched = 0;
let turns = 0;
let hideTimer;

const scoreKey = 'gospel-matching-best-v1';
let bestScores = {};
try {
  const saved = JSON.parse(localStorage.getItem(scoreKey) || '{}');
  for (const size of [4, 5, 6]) {
    if (Number.isInteger(saved[size]) && saved[size] >= Math.floor(size * size / 2)) bestScores[size] = saved[size];
  }
} catch {
  // The game still works if private browsing blocks local storage.
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function playNotes(notes) {
  if (!soundOn) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const start = audioContext.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start + index * .09);
      gain.gain.linearRampToValueAtTime(.05, start + index * .09 + .015);
      gain.gain.exponentialRampToValueAtTime(.001, start + index * .09 + .32);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start + index * .09);
      oscillator.stop(start + index * .09 + .34);
    });
  } catch {
    // Sound is optional.
  }
}

function updateScore() {
  $('gameStats').textContent = `Pairs ${matched} / ${pairCount} · Turns ${turns}`;
  $('gameBest').textContent = `Best ${boardSize}×${boardSize}: ${bestScores[boardSize] === undefined ? '—' : bestScores[boardSize] + ' turns'}`;
}

function showReading(cards) {
  const reading = $('gameReading');
  reading.replaceChildren();
  if (!cards.length) {
    const prompt = document.createElement('span');
    prompt.textContent = 'Choose a card to reveal a gospel principle.';
    reading.append(prompt);
    return;
  }
  cards.forEach(card => {
    const text = document.createElement('span');
    text.textContent = `${card.icon} ${card.text}`;
    reading.append(text);
  });
}

function makeFace(className) {
  const face = document.createElement('span');
  face.className = `card-face ${className}`;
  face.setAttribute('aria-hidden', 'true');
  return face;
}

function renderCard(index) {
  const button = $('gameBoard').children[index];
  const card = deck[index];
  button.replaceChildren();
  const inner = document.createElement('span');
  inner.className = 'game-card-inner';
  const back = makeFace('card-back');
  const front = makeFace('card-front');
  const icon = document.createElement('span');
  icon.className = 'card-icon';
  icon.textContent = card.icon;
  const text = document.createElement('span');
  text.className = 'card-text';
  text.textContent = card.text;
  front.append(icon, text);
  inner.append(back, front);
  button.append(inner);
}

function reveal(index, isShown) {
  const button = $('gameBoard').children[index];
  button.classList.toggle('flipped', isShown);
  button.setAttribute('aria-pressed', String(isShown));
  button.setAttribute('aria-label', isShown ? deck[index].text : `Card ${index + 1}, face down`);
}

function finishGame() {
  const prior = bestScores[boardSize];
  const isRecord = prior === undefined || turns < prior;
  const record = $('gameRecord');
  record.hidden = false;
  record.classList.toggle('new-record', isRecord);
  if (isRecord) {
    bestScores[boardSize] = turns;
    try { localStorage.setItem(scoreKey, JSON.stringify(bestScores)); } catch { /* Keep the score for this visit. */ }
    record.textContent = `★ New best! You found ${pairCount} pairs in ${turns} turns.`;
    playNotes([523.25, 659.25, 783.99]);
  } else if (turns === prior) {
    record.textContent = `You tied your best: ${turns} turns!`;
    playNotes([523.25, 659.25]);
  } else {
    record.textContent = `Board complete in ${turns} turns. Your best is ${prior}.`;
    playNotes([523.25, 659.25]);
  }
  $('gameFeedback').textContent = 'All pairs found! Which principle will you practice this week?';
}

function chooseCard(index) {
  const button = $('gameBoard').children[index];
  if (locked || button.disabled || selected.includes(index)) return;
  reveal(index, true);
  selected.push(index);
  showReading(selected.map(cardIndex => deck[cardIndex]));

  if (selected.length === 1) {
    $('gameFeedback').textContent = 'Choose a second card.';
    return;
  }

  turns += 1;
  const [first, second] = selected;
  if (deck[first].pairId === deck[second].pairId) {
    matched += 1;
    selected.forEach(cardIndex => {
      const cardButton = $('gameBoard').children[cardIndex];
      cardButton.classList.add('matched');
      cardButton.disabled = true;
    });
    selected = [];
    playNotes([523.25, 659.25]);
    $('gameFeedback').textContent = matched === pairCount
      ? 'All pairs found! Which principle will you practice this week?'
      : 'A match! Explain how those two ideas belong together.';
  } else {
    locked = true;
    $('gameFeedback').textContent = 'Not a match. Remember where they are.';
    hideTimer = window.setTimeout(() => {
      selected.forEach(cardIndex => reveal(cardIndex, false));
      selected = [];
      locked = false;
      showReading([]);
      $('gameFeedback').textContent = 'Try another pair.';
    }, 1400);
  }

  updateScore();
  if (matched === pairCount) finishGame();
}

function resetGame() {
  window.clearTimeout(hideTimer);
  selected = [];
  locked = false;
  matched = 0;
  turns = 0;
  pairCount = Math.floor(boardSize * boardSize / 2);
  const chosenPairs = shuffle(gospelPairs).slice(0, pairCount);
  deck = shuffle(chosenPairs.flatMap((pair, pairId) => [
    {pairId, text: pair.name, icon: pair.icon},
    {pairId, text: pair.meaning, icon: pair.icon}
  ]));

  if (boardSize === 5) deck.splice(12, 0, {free: true});

  const board = $('gameBoard');
  board.style.setProperty('--board-size', boardSize);
  board.replaceChildren();
  deck.forEach((card, index) => {
    if (card.free) {
      const free = document.createElement('div');
      free.className = 'game-card free';
      free.textContent = '✦ Free space';
      free.setAttribute('aria-label', 'Free center space');
      board.append(free);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-card';
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => chooseCard(index));
    board.append(button);
    renderCard(index);
    reveal(index, false);
  });

  document.querySelectorAll('[data-board-size]').forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.boardSize) === boardSize));
  });
  $('gameRecord').hidden = true;
  $('gameRecord').textContent = '';
  $('gameFeedback').textContent = boardSize === 5 ? 'Turn over two cards. The center is a free space.' : 'Turn over two cards.';
  showReading([]);
  updateScore();
  $('gameStage').scrollTo({left: 0, top: 0});
}

function setClassroomMode(enabled) {
  document.body.classList.toggle('classroom', enabled);
  $('focusToggle').setAttribute('aria-pressed', String(enabled));
  $('focusToggle').textContent = enabled ? 'Back to page' : 'Classroom mode';
  if (enabled) $('focusToggle').focus();
}

$('soundToggle').addEventListener('click', () => {
  soundOn = !soundOn;
  $('soundToggle').setAttribute('aria-pressed', String(soundOn));
  $('soundToggle').textContent = soundOn ? 'Sound on' : 'Sound off';
  playNotes([523.25, 659.25]);
});

document.querySelectorAll('[data-board-size]').forEach(button => {
  button.addEventListener('click', () => {
    boardSize = Number(button.dataset.boardSize);
    resetGame();
  });
});

$('gameReset').addEventListener('click', resetGame);
$('focusToggle').addEventListener('click', () => setClassroomMode(!document.body.classList.contains('classroom')));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('classroom')) setClassroomMode(false);
});

resetGame();
