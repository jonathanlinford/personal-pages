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
  {name:'Second Coming', meaning:'Jesus Christ will return to reign on the earth', image:'second-coming.jpg', art:'The Ascension of Jesus'},
  {name:'Obedience', meaning:'Choose to follow God even when it takes faith', image:'obedience.jpg', art:'Noah and the Ark with Animals'},
  {name:'Humility', meaning:'Put aside pride and be willing to serve', image:'humility.jpg', art:'Jesus Washing the Apostles’ Feet'},
  {name:'Agency', meaning:'God lets us choose and learn from our choices', image:'agency.jpg', art:'Adam and Eve'},
  {name:'Family history', meaning:'Find and remember ancestors so they can receive temple blessings', image:'family-history.jpg', art:'Get into Family History'},
  {name:'Preparation', meaning:'Build faith now so we are ready when the Lord calls', image:'preparation.jpg', art:'Five of Them Were Wise'},
  {name:'Hope', meaning:'Trust the Savior and look forward with confidence', image:'hope.jpg', art:'Mary and the Resurrected Lord'},
  {name:'Learning', meaning:'Seek truth through study, faith, and good questions', image:'learning.jpg', art:'Boy Jesus in the Temple'},
  {name:'Unity', meaning:'Become one in heart by loving and serving each other', image:'unity.jpg', art:'City of Zion Is Taken Up'}
];

const players = [
  {name:'Dad', initial:'D', image:'assets/gospel-matching/players/dad.jpg'},
  {name:'Mom', initial:'M', image:'assets/gospel-matching/players/mom.jpg'},
  {name:'Luke', initial:'L', image:'assets/gospel-matching/players/luke.jpg'},
  {name:'Sally', initial:'S', image:'assets/gospel-matching/players/sally.jpg'}
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
let currentPlayer = null;

const historyKey = 'gospel-matching-player-history-v1';
let playerHistory = {};
try {
  const saved = JSON.parse(localStorage.getItem(historyKey) || '{}');
  if (saved && typeof saved === 'object') playerHistory = saved;
} catch {
  // Player history simply lasts for this visit if storage is unavailable.
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function gamesFor(playerName, size = boardSize) {
  playerHistory[playerName] ??= {};
  playerHistory[playerName][size] ??= [];
  return playerHistory[playerName][size];
}

function bestFor(playerName, size = boardSize) {
  const scores = gamesFor(playerName, size).map(game => game.turns).filter(Number.isInteger);
  return scores.length ? Math.min(...scores) : undefined;
}

function saveHistory() {
  try { localStorage.setItem(historyKey, JSON.stringify(playerHistory)); } catch { /* Keep it for this visit. */ }
}

function progressText(playerName, size = boardSize) {
  const games = gamesFor(playerName, size);
  if (!games.length) return `No completed ${size}×${size} games yet.`;
  if (games.length === 1) return `First ${size}×${size} score: ${games[0].turns} turns.`;
  const latest = games.at(-1).turns;
  const prior = games.at(-2).turns;
  if (latest < prior) return `Last game: ${latest} turns · improved by ${prior - latest}.`;
  if (latest === prior) return `Last game: ${latest} turns · tied the previous game.`;
  return `Last game: ${latest} turns · ${latest - prior} more than the previous game.`;
}

function setAvatar(element, player) {
  element.textContent = player.initial;
  element.classList.toggle('has-photo', Boolean(player.image));
  element.style.backgroundImage = player.image ? `url("${player.image}")` : '';
}

function updatePlayerSummaries() {
  document.querySelectorAll('[data-player-summary]').forEach(summary => {
    const name = summary.dataset.playerSummary;
    const totalGames = Object.values(playerHistory[name] || {}).reduce((sum, games) => sum + (Array.isArray(games) ? games.length : 0), 0);
    const best = bestFor(name);
    summary.textContent = best === undefined
      ? (totalGames ? `${totalGames} completed · no ${boardSize}×${boardSize} score` : 'No games yet')
      : `Best ${boardSize}×${boardSize}: ${best} turns`;
  });
}

function renderLeaderboard() {
  const list = $('leaderboardList');
  list.replaceChildren();
  players
    .map((player, order) => ({...player, order, best:bestFor(player.name)}))
    .sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity) || a.order - b.order)
    .forEach((player, index) => {
      const item = document.createElement('li');
      if (player.name === currentPlayer) item.className = 'current';
      const rank = document.createElement('b');
      rank.textContent = player.best === undefined ? '—' : String(index + 1);
      const avatar = document.createElement('span');
      avatar.className = 'leader-avatar player-initial';
      setAvatar(avatar, player);
      const name = document.createElement('span');
      name.textContent = player.name;
      const score = document.createElement('strong');
      score.textContent = player.best === undefined ? 'No score' : `${player.best} turns`;
      item.append(rank, avatar, name, score);
      list.append(item);
    });
}

function updatePlayerUI() {
  const player = players.find(item => item.name === currentPlayer);
  $('changePlayer').textContent = player ? `Player: ${player.name}` : 'Choose player';
  $('activePlayerName').textContent = player ? player.name : 'Choose a player';
  $('playerProgress').textContent = player ? progressText(player.name) : 'Select who is playing to begin.';
  if (player) setAvatar($('activePlayerAvatar'), player);
  updatePlayerSummaries();
  renderLeaderboard();
}

function openPlayerDialog() {
  updatePlayerSummaries();
  const dialog = $('playerDialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
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
  const best = currentPlayer ? bestFor(currentPlayer) : undefined;
  $('gameBest').textContent = `Best ${boardSize}×${boardSize}${currentPlayer ? ` for ${currentPlayer}` : ''}: ${best === undefined ? '—' : best + ' turns'}`;
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
  const games = gamesFor(currentPlayer);
  const priorGame = games.at(-1);
  const priorBest = bestFor(currentPlayer);
  const isRecord = priorBest === undefined || turns < priorBest;
  games.push({turns, at:new Date().toISOString()});
  if (games.length > 30) games.splice(0, games.length - 30);
  saveHistory();
  const record = $('gameRecord');
  record.hidden = false;
  record.classList.toggle('new-record', isRecord);
  if (isRecord) {
    record.textContent = `★ New best for ${currentPlayer}! You found ${pairCount} pairs in ${turns} turns.`;
    playNotes([523.25, 659.25, 783.99]);
  } else if (turns === priorBest) {
    record.textContent = `You tied your best: ${turns} turns!`;
    playNotes([523.25, 659.25]);
  } else {
    record.textContent = `Board complete in ${turns} turns. Your best is ${priorBest}.`;
    playNotes([523.25, 659.25]);
  }
  if (priorGame) {
    const change = priorGame.turns - turns;
    record.textContent += change > 0 ? ` You improved by ${change} turns.` : change === 0 ? ' You matched your last game.' : ` Last game took ${priorGame.turns} turns.`;
  }
  updatePlayerUI();
  updateScore();
  $('gameFeedback').textContent = 'All pairs found! Which principle will you practice this week?';
}

function chooseCard(index) {
  if (!currentPlayer) {
    openPlayerDialog();
    return;
  }
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
  updatePlayerUI();
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
    openPlayerDialog();
  });
});

document.querySelectorAll('[data-player]').forEach(button => {
  button.addEventListener('click', () => {
    currentPlayer = button.dataset.player;
    $('playerDialog').close();
    resetGame();
  });
});

$('playerDialog').addEventListener('cancel', event => event.preventDefault());
$('changePlayer').addEventListener('click', async () => {
  if (document.body.classList.contains('classroom')) await setClassroomMode(false);
  openPlayerDialog();
});

$('gameReset').addEventListener('click', openPlayerDialog);
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
updatePlayerUI();
openPlayerDialog();
