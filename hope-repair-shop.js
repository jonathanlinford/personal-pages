'use strict';
const $ = id => document.getElementById(id);
const completed = new Set();
const tools = new Set();
let rescued = false;
document.querySelectorAll('[data-complete]').forEach(button => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    const id = button.dataset.complete;
    if (completed.has(id)) return;
    completed.add(id);
    button.setAttribute('aria-pressed', 'true');
    const stamp = document.querySelector(`[data-stamp="${id}"]`);
    stamp.textContent = 'Discovered';
    stamp.classList.add('complete');
    $('progress').textContent = `${completed.size} / 4 discoveries`;
  });
});
$('teacherToggle').addEventListener('click', () => {
  const enabled = document.body.classList.toggle('teacher-mode');
  $('teacherToggle').setAttribute('aria-pressed', String(enabled));
  $('teacherToggle').textContent = enabled ? 'Teacher mode on' : 'Teacher mode';
});
$('futureToggle').addEventListener('click', () => {
  const future = $('fieldView').classList.toggle('future');
  $('futureToggle').setAttribute('aria-pressed', String(future));
  $('futureToggle').textContent = future ? 'Return to the difficult present ↶' : 'Picture the promised future ↗';
  $('fieldMessage').textContent = future ? 'God promises a future.' : 'The trouble is real.';
  $('fieldCaption').textContent = future ? 'The promise: houses, fields, and vineyards in the land again. Not immediately—but God has not forgotten His people.' : 'Now: danger, prison, and an uncertain future.';
});
const toolMessages = {
  speak: 'Verses 7–10: Ebed-melech speaks to the king and receives permission to take helpers. Speaking up starts the rescue.',
  rope: 'Verses 10–11, 13: helpers and cords make it possible to pull Jeremiah out. Working together matters.',
  cloth: 'Verses 11–12: old cloth goes under Jeremiah’s arms, beneath the ropes. Gentleness belongs in the plan.'
};
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
  if (rescued) return;
  const tool = button.dataset.tool;
  tools.add(tool);
  button.setAttribute('aria-pressed', 'true');
  $('toolFeedback').textContent = toolMessages[tool];
  $('rescueRope').setAttribute('opacity', tools.has('rope') ? '1' : '.25');
  $('rescueCloth').setAttribute('opacity', tools.has('cloth') ? '1' : '0');
}));
$('lift').addEventListener('click', () => {
  if (rescued) return;
  const missing = ['speak', 'rope', 'cloth'].filter(tool => !tools.has(tool));
  if (missing.length) {
    const hints = { speak: 'Who speaks to the king and gathers help in verses 7–10?', rope: 'What do the helpers use to draw Jeremiah out in verse 13?', cloth: 'What thoughtful protection does Ebed-melech add in verse 12?' };
    $('rescueFeedback').textContent = `Look back at the evidence. ${hints[missing[0]]}`;
    return;
  }
  rescued = true;
  $('jeremiahFigure').style.transform = 'translateY(-240px)';
  $('rescueRope').style.transform = 'translateY(-240px)';
  $('pitTitle').textContent = 'Jeremiah is drawn out of the muddy pit with rope, soft cloth, and help from others';
  $('rescueFeedback').textContent = 'Jeremiah is brought out of the pit! He remains in the prison courtyard. Ebed-melech’s brave, thoughtful help made a difference.';
  $('lift').textContent = 'Out of the pit ✓';
  $('lift').disabled = true;
});
$('resetRescue').addEventListener('click', () => {
  tools.clear(); rescued = false;
  document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  $('rescueRope').setAttribute('opacity', '.25'); $('rescueCloth').setAttribute('opacity', '0');
  $('jeremiahFigure').style.transform = '';
  $('rescueRope').style.transform = '';
  $('pitTitle').textContent = 'A cutaway illustration of Jeremiah in a muddy pit, with a rescue rope above';
  $('toolFeedback').textContent = 'Which part would you have thought of first?';
  $('rescueFeedback').textContent = 'The pit is deep. One person does not have to solve this alone.';
  $('lift').disabled = false; $('lift').textContent = 'Try the rescue plan ↑';
});
const scenarios = {
  alone: { question: 'You notice a child sitting alone while everyone else makes groups. What could love look like?', action: 'Make room.\nInvite someone in.', example: '“Would you like to join us?” Then move over and make a real place for them. Respect their answer and keep being kind.' },
  mistake: { question: 'You said something unkind and now wish you hadn’t. What could turning to Jesus look like?', action: 'Turn to Jesus.\nMake things right.', example: 'Pray for help, apologize without making excuses, and do what you can to repair the hurt. Practice a kinder response next time.' },
  honest: { question: 'You realize you received credit for work you did not do. Nobody else has noticed. What could honesty look like?', action: 'Tell the truth.\nEven quietly.', example: 'Tell the teacher what happened and give the other person credit. Ask Jesus for courage to do what is right even without applause.' }
};
let scenario = 'alone';
document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => {
  scenario = button.dataset.scenario;
  document.querySelectorAll('[data-scenario]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  $('scenarioText').textContent = scenarios[scenario].question;
  $('heartAnswer').hidden = true;
  $('heartExample').setAttribute('aria-expanded', 'false');
  $('heartExample').textContent = 'We have an idea. Show one example.';
  $('heartWords').textContent = 'What could love look like?';
  $('heartGraphicTitle').textContent = 'A paper heart ready to hold a kind action';
}));
$('heartExample').addEventListener('click', () => {
  const open = $('heartAnswer').hidden;
  $('heartAnswer').hidden = !open;
  $('heartExample').setAttribute('aria-expanded', String(open));
  $('heartExample').textContent = open ? 'Hide the example' : 'We have an idea. Show one example.';
  $('heartAnswer').textContent = scenarios[scenario].example;
  $('heartWords').textContent = open ? scenarios[scenario].action : 'What could love look like?';
  $('heartWords').style.whiteSpace = 'pre-line';
  $('heartGraphicTitle').textContent = open ? `A paper heart with the action: ${scenarios[scenario].action.replace('\n', ' ')}` : 'A paper heart ready to hold a kind action';
});
$('dawnToggle').addEventListener('click', () => {
  const morning = $('dawn').classList.toggle('morning');
  $('dawnToggle').setAttribute('aria-pressed', String(morning));
  $('dawnToggle').textContent = morning ? 'Return to the night ↶' : 'Look for the morning ↗';
  $('dawnText').textContent = morning ? 'The Lord’s mercies are new every morning.' : 'A hard night is not the whole story.';
});
const invitations = {
  trust: ['Keep trying something good.', 'When I feel stuck, I can pray for help and take one small, good next step. I do not have to know the whole future.'],
  help: ['Be somebody’s gentle helper.', 'This week, I will notice someone who needs a friend, listen, and offer one kind action. I can get a trusted adult’s help when needed.'],
  live: ['Carry a promise into a choice.', 'When a hard choice comes, I can pause and ask: “What would following Jesus look like right now?” Then I can take that step with His help.']
};
document.querySelectorAll('[data-invitation]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-invitation]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  const [title, text] = invitations[button.dataset.invitation];
  $('ticketTitle').textContent = title; $('ticketText').textContent = text;
}));
$('printLesson').addEventListener('click', () => window.print());
const nav = [...document.querySelectorAll('.shop-nav a')];
function markSection() {
  let active = null;
  nav.forEach(link => { if (document.querySelector(link.hash).getBoundingClientRect().top <= innerHeight * .4) active = link; });
  nav.forEach(link => { if (link === active) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current'); });
}
addEventListener('scroll', markSection, { passive: true });
markSection();
