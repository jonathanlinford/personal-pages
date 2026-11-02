'use strict';
const $ = id => document.getElementById(id);
let readAloud = false;
function speak(text, force = false) {
  if (!readAloud && !force) return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    $('narrationStatus').textContent = 'Read-aloud is unavailable here. Read the caption together.';
    return;
  }
  try {
    speechSynthesis.cancel();
    const line = new SpeechSynthesisUtterance(text);
    line.lang = 'en-US'; line.rate = .88;
    line.onerror = () => { $('narrationStatus').textContent = 'If you cannot hear the voice, read the caption together.'; };
    speechSynthesis.speak(line);
    $('narrationStatus').textContent = 'Listening together. You can always read the words on screen.';
  } catch { $('narrationStatus').textContent = 'Read the caption together; read-aloud is unavailable here.'; }
}
$('soundToggle').addEventListener('click', () => {
  readAloud = !readAloud;
  $('soundToggle').setAttribute('aria-pressed', String(readAloud));
  $('soundToggle').textContent = readAloud ? 'Read-aloud on' : 'Read-aloud off';
  if (readAloud) speak('Luke and Sally, let’s look again!');
  else if ('speechSynthesis' in window) speechSynthesis.cancel();
});
document.querySelectorAll('[data-found]').forEach(button => button.addEventListener('click', () => {
  const found = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(found));
  button.textContent = `${button.dataset.found === 'luke' ? 'Luke' : 'Sally'} ${found ? 'has a discovery! ✓' : 'has an idea ✓'}`;
}));
let remaining = 120, timerId = null, deadline = 0;
function showTime() {
  $('huntClock').textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
}
function stopTimer() { clearInterval(timerId); timerId = null; }
function tick() {
  remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  showTime();
  if (!remaining) { stopTimer(); $('timerToggle').textContent = 'Hunt finished'; $('timerToggle').disabled = true; $('timerMessage').textContent = 'Come back with your object or your idea. Let’s hear how it works!'; }
}
$('timerToggle').addEventListener('click', () => {
  if (timerId !== null) { tick(); stopTimer(); if (remaining) $('timerToggle').textContent = 'Keep hunting'; return; }
  if (!remaining) return;
  deadline = Date.now() + remaining * 1000;
  timerId = setInterval(tick, 250);
  $('timerToggle').textContent = 'Pause clock';
  $('timerMessage').textContent = 'Look, wonder, and help each other.';
});
$('timerReset').addEventListener('click', () => { stopTimer(); remaining = 120; showTime(); $('timerToggle').textContent = 'Start 2-minute hunt'; $('timerToggle').disabled = false; $('timerMessage').textContent = 'No race. Help each other.'; });

const scene = $('storyScene');
let part = 1, animationTimer = null;
const captions = {
  1: 'Milo is taking bread to a friend. From where he stands, the path looks clear. The watchman is much higher up.',
  2: 'From higher up, we can see the puddle and a dry stepping-stone path. Before Milo moves, predict what his feet will be like on each route.',
  3: 'The watchman wants to help. What could he say? Try a short warning and then a warning that explains what to do.'
};
function clearMotion() {
  clearTimeout(animationTimer); animationTimer = null;
  scene.classList.remove('walk-straight', 'walk-stones', 'wet', 'warning', 'pause-walker');
  document.querySelectorAll('[data-route], [data-warning]').forEach(button => { button.disabled = false; button.setAttribute('aria-pressed', 'false'); });
}
function setCaption(text) { $('storyCaption').textContent = text; speak(text); }
function showPart(value) {
  part = value; clearMotion();
  $('partOne').hidden = part !== 1; $('partTwo').hidden = part !== 2; $('partThree').hidden = part !== 3;
  $('nextPart').hidden = true; $('finishStory').hidden = true;
  $('viewFeedback').textContent = ''; $('routeFeedback').textContent = ''; $('warningFeedback').textContent = '';
  scene.classList.toggle('high', part !== 1); scene.classList.toggle('ground', part === 1);
  $('partLabel').textContent = `Part ${part} / 3 · ${['A different view', 'Choose a path', 'A kind warning'][part - 1]}`;
  $('storyQuestion').textContent = [
    'Can the path look clear and still have something around the bend?',
    'What changed: the puddle, or what Milo could know about it?',
    'Which warning helps Milo know what to do next? Can a short warning help, too?'
  ][part - 1];
  $('viewLabel').textContent = part === 1 ? 'From the path: the hill hides what’s next.' : 'From the tower: more of the same path comes into view.';
  $('sceneTitle').textContent = part === 1 ? 'A traveler cannot see the puddle around a bend' : 'From the tower, the puddle and dry stepping stones are visible';
  $('lookFromTower').textContent = 'Watch from the tower ↗';
  setCaption(captions[part]);
}
$('lookFromTower').addEventListener('click', () => {
  scene.classList.add('high'); scene.classList.remove('ground');
  scene.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  $('viewLabel').textContent = 'From the tower: there is a puddle around the bend!';
  $('sceneTitle').textContent = 'The higher view reveals a puddle and a dry path of stepping stones';
  $('viewFeedback').textContent = 'The puddle was there all along. The watchman’s different view helps Milo notice it.';
  $('nextPart').hidden = false;
  $('lookFromTower').textContent = 'Look from the tower again ↗';
  setCaption('Look again! There is water around the bend. The watchman can also see dry stepping stones. The puddle did not suddenly appear; now we know more about the path.');
});
function animateRoute(route, button, isWarning = false) {
  clearMotion();
  void scene.offsetWidth; // Restart a route when the same choice is replayed.
  button.setAttribute('aria-pressed', 'true');
  if (isWarning) { scene.classList.add('warning'); $('warningWords').textContent = 'Puddle ahead—try the stones!'; }
  scene.classList.add(route === 'straight' ? 'walk-straight' : 'walk-stones');
  scene.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('[data-route], [data-warning]').forEach(b => { b.disabled = true; });
  const text = route === 'straight' ? 'Milo tries the lower path. Watch his shoes as he reaches the water.' : 'Milo tries the stepping stones. Watch how he goes around the puddle.';
  setCaption(text);
  animationTimer = setTimeout(() => {
    const wet = route === 'straight';
    scene.classList.toggle('wet', wet);
    $('sceneTitle').textContent = wet ? 'Milo reaches his friend with wet shoes after taking the puddle path' : 'Milo reaches his friend with dry shoes after taking the stepping-stone path';
    const result = wet ? 'Wet shoes! There was more to the path than Milo could see at first. What could help him choose differently next time?' : 'Dry shoes! New information helped Milo choose a different route. The warning gave him a useful next step.';
    $(isWarning ? 'warningFeedback' : 'routeFeedback').textContent = result;
    document.querySelectorAll('[data-route], [data-warning]').forEach(b => { b.disabled = false; });
    if (part === 2) $('nextPart').hidden = false; else $('finishStory').hidden = false;
    speak(result); animationTimer = null;
  }, 4100);
}
document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', () => animateRoute(button.dataset.route, button)));
document.querySelectorAll('[data-warning]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.warning === 'explain') { animateRoute('stones', button, true); return; }
  clearMotion(); button.setAttribute('aria-pressed', 'true'); scene.classList.add('warning', 'pause-walker');
  $('warningWords').textContent = 'Stop!';
  scene.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  setCaption('The watchman says, “Stop!” Milo pauses. That short warning gets his attention. What information would help him choose a next step?');
  $('warningFeedback').textContent = 'A short warning can help us pause. An explanation can help us understand why and what to do next. What would you ask the watchman?';
  $('finishStory').hidden = false;
}));
$('nextPart').addEventListener('click', () => { if (part < 3) showPart(part + 1); });
$('restartStory').addEventListener('click', () => showPart(1));
$('replayPart').addEventListener('click', () => speak($('storyCaption').textContent, true));
addEventListener('pagehide', () => { stopTimer(); clearTimeout(animationTimer); if ('speechSynthesis' in window) speechSynthesis.cancel(); });
