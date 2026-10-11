'use strict';

const $ = id => document.getElementById(id);
const viewportMeta = document.querySelector('meta[name="viewport"]');
const standardViewport = viewportMeta.content;

const gospelPairs = [
  {name:'Jesus Christ', meaning:'Our Savior and the center of the gospel', image:'christ.jpg', art:'Christ and Children from around the World'},
  {name:'Faith in Jesus Christ', meaning:'Trust Him enough to follow Him', image:'faith.jpg', art:'The Lost Lamb'},
  {name:'Repentance', meaning:'Turn to Christ and choose to change', image:'repentance.jpg', art:'Conversion of Alma the Younger'},
  {name:'Baptism', meaning:'Make our first covenant with God', image:'baptism.jpg', art:'Girl Being Baptized'},
  {name:'Gift of the Holy Ghost', meaning:'Receive comfort, guidance, and truth', image:'holy-ghost.jpg', art:'The Gift of the Holy Ghost'},
  {name:'Prayer', meaning:'Speak with Heavenly Father', image:'prayer.jpg', art:'Family Prayer'},
  {name:'Scriptures', meaning:'Study the word of God', image:'scriptures.jpg', art:'Joseph Smith Seeks Wisdom in the Bible'},
  {name:'Sacrament', meaning:'Remember Jesus and renew our covenants', image:'sacrament.jpg', art:'Blessing the Sacrament'},
  {name:'Temple', meaning:'Make sacred covenants and unite families', image:'temple.jpg', art:'Kirtland Temple'},
  {name:'Prophets', meaning:'Hear guidance God gives to His people', image:'prophets.jpg', art:'Boy Samuel Called by the Lord'},
  {name:'Service', meaning:'Follow Jesus by helping someone', image:'service.jpg', art:'Service'},
  {name:'Tithing', meaning:'Give one tenth to the Lord', image:'tithing.jpg', art:'Payment of Tithing'},
  {name:'Sabbath day', meaning:'Worship God and rest from ordinary work', image:'sabbath.jpg', art:'Passing the Sacrament'},
  {name:'Word of Wisdom', meaning:'Care for our bodies and avoid harmful things', image:'word-of-wisdom.jpg', art:'Daniel Refusing the King’s Meat and Wine'},
  {name:'Missionary work', meaning:'Invite others to come unto Christ', image:'missionary.jpg', art:'Missionaries: Elders'},
  {name:'Priesthood', meaning:'God’s authority to bless and serve', image:'priesthood.jpg', art:'Ordination to the Priesthood'},
  {name:'Eternal families', meaning:'Family relationships can continue forever', image:'eternal-families.jpg', art:'Young Couple Going to the Temple'},
  {name:'Covenant path', meaning:'Keep making and honoring promises with God', image:'covenant-path.jpg', art:'Lehi’s Dream'},
  {name:'Charity', meaning:'Love God and care for our neighbors', image:'charity.jpg', art:'The Good Samaritan'},
  {name:'Resurrection', meaning:'Because of Jesus Christ, everyone will live again', image:'resurrection.jpg', art:'Jesus Shows His Wounds'},
  {name:'Creation', meaning:'God created the earth and all living things', image:'creation.jpg', art:'The Lord Created All Things'},
  {name:'Commandments', meaning:'God’s loving directions help us choose the right', image:'commandments.jpg', art:'Moses and the Tablets'},
  {name:'Book of Mormon', meaning:'Another testament of Jesus Christ', image:'book-of-mormon.jpg', art:'Mormon Abridging the Plates'},
  {name:'Personal revelation', meaning:'God can speak to our minds and hearts', image:'revelation.jpg', art:'The Brother of Jared Sees the Finger of the Lord'},
  {name:'Atonement of Jesus Christ', meaning:'Jesus Christ makes repentance and eternal life possible', image:'atonement.jpg', art:'Jesus Praying in Gethsemane'},
  {name:'Forgiveness', meaning:'Let go of resentment and welcome others back with love', image:'forgiveness.jpg', art:'Jesus Teaches of the Prodigal Son'},
  {name:'Gratitude', meaning:'Notice God’s blessings and give thanks', image:'gratitude.jpg', art:'The Healing of the Ten Lepers'},
  {name:'Peace in Christ', meaning:'The Savior can calm our hearts during life’s storms', image:'peace.jpg', art:'Jesus Calms the Storm'},
  {name:'Fasting', meaning:'Go without food and drink for a time to draw closer to God', image:'fasting.jpg', art:'Esther'},
  {name:'Restoration', meaning:'Jesus Christ brought back His gospel and priesthood', image:'restoration.jpg', art:'The First Vision'},
  {name:'Endure to the end', meaning:'Keep following Jesus Christ through every trial', image:'endure.jpg', art:'Three Men in the Fiery Furnace'},
  {name:'Second Coming', meaning:'Jesus Christ will return to reign on the earth', image:'second-coming.jpg', art:'The Ascension of Jesus'}
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
  for (const size of [4, 5, 6, 7, 8]) {
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
    text.textContent = card.text;
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
  const image = document.createElement('img');
  image.className = 'card-image';
  image.src = `assets/gospel-matching/${card.image}`;
  image.alt = '';
  image.loading = 'eager';
  const text = document.createElement('span');
  text.className = 'card-text';
  text.textContent = card.text;
  front.append(image, text);
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
    {pairId, text: pair.name, image: pair.image, art: pair.art},
    {pairId, text: pair.meaning, image: pair.image, art: pair.art}
  ]));

  if (boardSize % 2 === 1) deck.splice(Math.floor(boardSize * boardSize / 2), 0, {free: true});

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
  $('gameFeedback').textContent = boardSize % 2 === 1 ? 'Turn over two cards. The center is a free space.' : 'Turn over two cards.';
  showReading([]);
  updateScore();
  $('gameStage').scrollTo({left: 0, top: 0});
}

function setClassroomLayout(enabled) {
  document.body.classList.toggle('classroom', enabled);
  viewportMeta.content = enabled
    ? `${standardViewport}, maximum-scale=1, user-scalable=no`
    : standardViewport;
  $('focusToggle').setAttribute('aria-pressed', String(enabled));
  $('focusToggle').textContent = enabled ? 'Exit full screen' : 'Full screen';
  if (enabled) $('focusToggle').focus();
}

async function setClassroomMode(enabled) {
  setClassroomLayout(enabled);
  try {
    if (enabled && document.fullscreenEnabled && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (!enabled && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // Keep the fitted classroom layout when a browser declines full screen.
  }
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
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('classroom')) setClassroomLayout(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('classroom')) setClassroomMode(false);
});
document.addEventListener('dblclick', event => {
  if (document.body.classList.contains('classroom')) event.preventDefault();
});
document.addEventListener('touchmove', event => {
  if (document.body.classList.contains('classroom') && event.touches.length > 1) event.preventDefault();
}, {passive:false});

resetGame();
