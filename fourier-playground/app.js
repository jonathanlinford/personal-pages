(() => {
  "use strict";

  const SAMPLE_COUNT = 512;
  const MAX_BINS = 24;
  const TAU = Math.PI * 2;
  const state = {
    mode: "build",
    fundamental: 220,
    amplitudes: [1, 0, 0, 0, 0, 0, 0, 0],
    phases: new Array(MAX_BINS).fill(0),
    signal: new Float32Array(SAMPLE_COUNT),
    coefficients: [],
    terms: 8,
    selectedBin: 0,
    drawing: false,
    hasDrawing: false,
    playing: false,
    audioContext: null,
    source: null,
    gain: null,
    lesson: 0,
    coachQuiz: null,
    coachHint: 0,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const waveformCanvas = $("#waveform");
  const spectrumCanvas = $("#spectrum");
  const waveformWrap = $("#waveform-wrap");
  const harmonicControls = $("#harmonic-controls");

  const lessons = [
    ["THE BIG IDEA", "A complicated wave can be built by adding simple sine waves. Move a harmonic and watch both pictures change."],
    ["TWO POINTS OF VIEW", "The top plot shows when values happen. The lower plot shows how much of each repeating frequency is present."],
    ["THE TRANSFORM", "A Fourier transform measures how strongly the signal matches every possible sine and cosine wave."],
    ["RECONSTRUCTION", "Keep adding frequency ingredients and the rebuilt signal approaches the original. Sharp corners need many high frequencies."],
    ["AMPLITUDE + PHASE", "Each ingredient has a strength and a starting position called phase. Together they preserve the entire signal."],
  ];

  function coachSay(message, label = "COACH") {
    $("#coach-response-label").textContent = label;
    $("#coach-response").textContent = message;
  }

  function signalProfile() {
    const bins = state.coefficients.slice(1, MAX_BINS + 1);
    const active = bins.map((c, index) => ({ index: index + 1, amplitude: c.amplitude }))
      .filter((item) => item.amplitude > .025)
      .sort((a, b) => b.amplitude - a.amplitude);
    const total = bins.reduce((sum, c) => sum + c.amplitude, 0) || 1;
    const centroid = bins.reduce((sum, c, index) => sum + c.amplitude * (index + 1), 0) / total;
    const odd = bins.reduce((sum, c, index) => sum + ((index + 1) % 2 ? c.amplitude : 0), 0);
    const even = bins.reduce((sum, c, index) => sum + ((index + 1) % 2 ? 0 : c.amplitude), 0);
    return { active, strongest: active[0] || { index: 1, amplitude: 0 }, centroid, odd, even, accuracy: Math.round(matchAccuracy(reconstruct())) };
  }

  function explainSignal() {
    const p = signalProfile();
    if (!p.active.length) {
      coachSay("This signal is flat, so the spectrum has no strong frequency yet. Draw a curve or add a harmonic, then ask again.", "WHAT I SEE");
      return;
    }
    const character = p.centroid < 2.1 ? "Most of its energy sits low in the spectrum" : p.centroid < 4.5 ? "Its energy is spread through the lower harmonics" : "A lot of its energy sits in the higher harmonics";
    const balance = p.odd > p.even * 2 ? "Odd harmonics dominate." : p.even > p.odd * 1.4 ? "Even harmonics are unusually strong." : "Odd and even harmonics both matter here.";
    coachSay(`${character}. Harmonic ${p.strongest.index} is strongest, and ${p.active.length} frequencies are clearly active. ${balance} With ${state.terms} frequencies, the rebuild matches ${p.accuracy}% of the original.`, "WHAT I SEE");
  }

  function startQuiz() {
    const p = signalProfile();
    state.coachHint = 0;
    if (!p.active.length || p.active.length === 1) {
      state.coachQuiz = "harmonics";
      coachSay("Before you try it: if you raise the third harmonic, what will change in the top waveform and where will a new bar appear below?", "YOUR TURN");
    } else if (p.accuracy < 90) {
      state.coachQuiz = "rebuild";
      coachSay(`The rebuild is at ${p.accuracy}%. Which end of the spectrum should you include next if you want to recover the small, sharp details? Try your answer with the Rebuild slider.`, "YOUR TURN");
    } else {
      state.coachQuiz = "brightness";
      coachSay("Predict first: what will happen to the sound and waveform if you cut the highest four harmonics? Then try Cut highs and listen.", "YOUR TURN");
    }
  }

  function giveHint() {
    if (!state.coachQuiz) {
      startQuiz();
      return;
    }
    state.coachHint += 1;
    const hints = {
      harmonics: [
        "Look at the bars as numbered frequency slots. The third control maps to the third slot.",
        "The new bar appears at three times the fundamental frequency. The top curve gains three smaller bends per cycle.",
        "Raise 3× and watch the third bar. You are adding a sine wave that completes three cycles while the fundamental completes one.",
      ],
      rebuild: [
        "Fine detail changes quickly, so think about which frequencies can change quickly.",
        "Higher frequencies carry the smaller and sharper features.",
        "Move Rebuild using to the right. Each added high-frequency bar restores more detail.",
      ],
      brightness: [
        "Brightness in sound usually follows the amount of energy high in the spectrum.",
        "Removing high bars smooths fast changes in the waveform.",
        "The sound becomes duller and the waveform becomes smoother because its quickest changes are gone.",
      ],
    };
    const list = hints[state.coachQuiz];
    coachSay(list[Math.min(state.coachHint - 1, list.length - 1)], state.coachHint >= 3 ? "ANSWER" : `HINT ${state.coachHint}`);
  }

  function applyCoachPrompt(rawPrompt) {
    const prompt = rawPrompt.trim().toLowerCase();
    if (!prompt) {
      coachSay("Tell me what you want the signal to sound or look like. For example: make it brighter.", "TRY A REQUEST");
      return;
    }
    setMode("build");
    let changedShape = false;
    const includes = (...words) => words.some((word) => prompt.includes(word));
    if (includes("square", "hollow")) { preset("square"); changedShape = true; }
    else if (includes("saw", "buzz")) { preset("saw"); changedShape = true; }
    else if (includes("triangle", "soft", "mellow", "warm")) { preset("triangle"); changedShape = true; }
    else if (includes("sine", "pure")) { preset("sine"); changedShape = true; }

    if (includes("bass", "lower", "low pitch", "deeper")) state.fundamental = Math.max(80, Math.round(state.fundamental * .55));
    if (includes("higher", "high pitch")) state.fundamental = Math.min(520, Math.round(state.fundamental * 1.35));
    if (includes("odd harmonic", "odd frequencies")) {
      state.amplitudes = state.amplitudes.map((value, index) => index % 2 === 0 ? Math.max(value, .7 / (index + 1)) : 0);
      changedShape = true;
    }
    if (includes("even harmonic", "even frequencies")) {
      state.amplitudes = state.amplitudes.map((value, index) => index % 2 ? Math.max(value, .55 / (index + 1)) : value);
      changedShape = true;
    }
    if (includes("bright", "sharper", "more high")) {
      state.amplitudes = state.amplitudes.map((value, index) => Math.min(1, value + (index > 1 ? .08 + index * .015 : 0)));
      changedShape = true;
    }
    if (includes("cut high", "remove high", "less high", "darker", "smoother")) {
      state.amplitudes = state.amplitudes.map((value, index) => index >= 4 ? 0 : value * (index < 2 ? 1 : .55));
      changedShape = true;
    }

    $("#fundamental").value = state.fundamental;
    if (changedShape) createHarmonicControls();
    buildSignal();
    if (changedShape || includes("bass", "lower", "low pitch", "deeper", "higher", "high pitch")) {
      coachSay(`Done. I changed the signal using “${rawPrompt.trim()}.” Look at the spectrum first, then play it and compare the sound.`, "CHANGED");
    } else {
      coachSay("I could not map that request to a control yet. Try words like warm, bright, bass, square, odd harmonics, or cut highs.", "I NEED A CLEARER REQUEST");
    }
  }

  function createHarmonicControls() {
    harmonicControls.innerHTML = "";
    state.amplitudes.forEach((value, index) => {
      const row = document.createElement("div");
      row.className = "harmonic-row";
      row.innerHTML = `<label for="harmonic-${index}">${index + 1}×</label><input class="range harmonic-range" id="harmonic-${index}" type="range" min="0" max="1" step="0.01" value="${value}" data-harmonic="${index}" aria-label="Harmonic ${index + 1} amplitude"><output>${Math.round(value * 100)}%</output>`;
      harmonicControls.appendChild(row);
    });
  }

  function preset(name) {
    const a = new Array(8).fill(0);
    if (name === "sine") a[0] = 1;
    if (name === "square") for (let n = 1; n <= 8; n += 2) a[n - 1] = 1 / n;
    if (name === "saw") for (let n = 1; n <= 8; n++) a[n - 1] = 1 / n;
    if (name === "triangle") for (let n = 1; n <= 8; n += 2) a[n - 1] = 1 / (n * n);
    state.amplitudes = a;
    state.phases.fill(0);
    createHarmonicControls();
    buildSignal();
    $$(".preset").forEach((button) => button.classList.toggle("active", button.dataset.preset === name));
  }

  function normalize(values, ceiling = 0.94) {
    let max = 0;
    values.forEach((value) => { max = Math.max(max, Math.abs(value)); });
    if (max > ceiling) values.forEach((_, i) => { values[i] *= ceiling / max; });
    return values;
  }

  function buildSignal() {
    const next = new Float32Array(SAMPLE_COUNT);
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = i / SAMPLE_COUNT;
      for (let h = 0; h < state.amplitudes.length; h++) {
        next[i] += state.amplitudes[h] * Math.sin(TAU * (h + 1) * t + state.phases[h]);
      }
    }
    state.signal = normalize(next);
    analyzeSignal();
  }

  function analyzeSignal() {
    const coefficients = [];
    for (let k = 0; k <= MAX_BINS; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < SAMPLE_COUNT; n++) {
        const angle = TAU * k * n / SAMPLE_COUNT;
        re += state.signal[n] * Math.cos(angle);
        im -= state.signal[n] * Math.sin(angle);
      }
      re /= SAMPLE_COUNT;
      im /= SAMPLE_COUNT;
      coefficients.push({ re, im, amplitude: k === 0 ? Math.abs(re) : 2 * Math.hypot(re, im), phase: Math.atan2(-im, re) - Math.PI / 2 });
    }
    state.coefficients = coefficients;
    updateReadouts();
    draw();
    if (state.playing) restartAudio();
  }

  function reconstruct() {
    const result = new Float32Array(SAMPLE_COUNT);
    const dc = state.coefficients[0]?.re || 0;
    for (let n = 0; n < SAMPLE_COUNT; n++) {
      let value = dc;
      for (let k = 1; k <= Math.min(state.terms, MAX_BINS); k++) {
        const c = state.coefficients[k];
        value += 2 * (c.re * Math.cos(TAU * k * n / SAMPLE_COUNT) - c.im * Math.sin(TAU * k * n / SAMPLE_COUNT));
      }
      result[n] = value;
    }
    return result;
  }

  function matchAccuracy(rebuilt) {
    let signalPower = 0;
    let errorPower = 0;
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      signalPower += state.signal[i] ** 2;
      errorPower += (state.signal[i] - rebuilt[i]) ** 2;
    }
    if (signalPower < 0.00001) return 100;
    return Math.max(0, Math.min(100, 100 * (1 - Math.sqrt(errorPower / signalPower))));
  }

  function canvasSetup(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width: rect.width, height: rect.height };
  }

  function drawGrid(ctx, width, height, columns = 8, rows = 4) {
    ctx.strokeStyle = "rgba(21,23,31,.10)";
    ctx.lineWidth = 1;
    for (let x = 1; x < columns; x++) {
      ctx.beginPath(); ctx.moveTo(x * width / columns, 0); ctx.lineTo(x * width / columns, height); ctx.stroke();
    }
    for (let y = 1; y < rows; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * height / rows); ctx.lineTo(width, y * height / rows); ctx.stroke();
    }
  }

  function signalPath(ctx, values, width, height, color, lineWidth, dashed = false) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.setLineDash(dashed ? [6, 5] : []);
    for (let i = 0; i < values.length; i++) {
      const x = i / (values.length - 1) * width;
      const y = height / 2 - values[i] * height * 0.4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawWaveform() {
    const { ctx, width, height } = canvasSetup(waveformCanvas);
    ctx.clearRect(0, 0, width, height);
    drawGrid(ctx, width, height);
    const rebuilt = reconstruct();
    signalPath(ctx, rebuilt, width, height, "#8d7bff", 3, true);
    signalPath(ctx, state.signal, width, height, "#15171f", 2);
    $("#accuracy-value").textContent = `${Math.round(matchAccuracy(rebuilt))}%`;
  }

  function drawSpectrum() {
    const { ctx, width, height } = canvasSetup(spectrumCanvas);
    ctx.clearRect(0, 0, width, height);
    drawGrid(ctx, width, height, 12, 4);
    const bins = state.coefficients.slice(1, MAX_BINS + 1);
    const maxAmp = Math.max(0.05, ...bins.map((c) => c.amplitude));
    const gap = width < 500 ? 2 : 5;
    const barWidth = Math.max(2, width / MAX_BINS - gap);
    bins.forEach((coefficient, index) => {
      const usableHeight = height - 30;
      const barHeight = Math.max(1, coefficient.amplitude / maxAmp * usableHeight * .9);
      const x = index * width / MAX_BINS + gap / 2;
      const y = height - 20 - barHeight;
      ctx.fillStyle = index === state.selectedBin ? "#8d7bff" : (index < state.terms ? "#15171f" : "rgba(21,23,31,.25)");
      ctx.fillRect(x, y, barWidth, barHeight);
      if (index < 12 && (width > 500 || index % 2 === 0)) {
        ctx.fillStyle = "#777873";
        ctx.font = "9px 'DM Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(index + 1), x + barWidth / 2, height - 6);
      }
    });
  }

  function draw() {
    drawWaveform();
    drawSpectrum();
  }

  function updateReadouts() {
    $("#frequency-value").textContent = `${state.fundamental} Hz`;
    $("#terms-value").textContent = state.terms;
    const frequency = Math.round((state.selectedBin + 1) * state.fundamental);
    $("#selected-bin").textContent = `${state.selectedBin + 1} × ${frequency} Hz`;
  }

  function setMode(mode) {
    stopAudio();
    state.mode = mode;
    document.body.dataset.mode = mode;
    $$(".mode-tab").forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    $$(".mode-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === mode));
    if (mode === "build") buildSignal();
    if (mode === "draw" && !state.hasDrawing) {
      state.signal = new Float32Array(SAMPLE_COUNT);
      analyzeSignal();
    }
  }

  function pointerToSignal(event) {
    const rect = waveformCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    return { index: Math.round(x / rect.width * (SAMPLE_COUNT - 1)), value: Math.max(-1, Math.min(1, (rect.height / 2 - y) / (rect.height * .4))) };
  }

  let previousPoint = null;
  function drawPointer(event) {
    if (state.mode !== "draw" || !state.drawing) return;
    const point = pointerToSignal(event);
    if (previousPoint) {
      const start = Math.min(previousPoint.index, point.index);
      const end = Math.max(previousPoint.index, point.index);
      for (let i = start; i <= end; i++) {
        const mix = end === start ? 1 : (i - start) / (end - start);
        const from = previousPoint.index <= point.index ? previousPoint.value : point.value;
        const to = previousPoint.index <= point.index ? point.value : previousPoint.value;
        state.signal[i] = from + (to - from) * mix;
      }
    } else state.signal[point.index] = point.value;
    previousPoint = point;
    state.hasDrawing = true;
    document.body.classList.add("has-drawing");
    analyzeSignal();
  }

  function smoothSignal() {
    const next = new Float32Array(SAMPLE_COUNT);
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      let sum = 0;
      let count = 0;
      for (let offset = -5; offset <= 5; offset++) {
        sum += state.signal[(i + offset + SAMPLE_COUNT) % SAMPLE_COUNT];
        count++;
      }
      next[i] = sum / count;
    }
    state.signal = next;
    analyzeSignal();
  }

  function randomSignal() {
    state.hasDrawing = true;
    document.body.classList.add("has-drawing");
    const ingredients = Array.from({ length: 7 }, (_, i) => ({ amp: Math.random() * .8 / (i + 1), phase: Math.random() * TAU }));
    const next = new Float32Array(SAMPLE_COUNT);
    for (let n = 0; n < SAMPLE_COUNT; n++) ingredients.forEach((item, i) => { next[n] += item.amp * Math.sin(TAU * (i + 1) * n / SAMPLE_COUNT + item.phase); });
    state.signal = normalize(next);
    analyzeSignal();
  }

  async function importAudioBuffer(arrayBuffer, label) {
    const context = state.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    state.audioContext = context;
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const channel = decoded.getChannelData(0);
    const windowLength = Math.min(channel.length, Math.max(SAMPLE_COUNT, Math.round(decoded.sampleRate * .035)));
    let bestStart = 0;
    let bestEnergy = -1;
    const step = Math.max(1, Math.floor(windowLength / 2));
    for (let start = 0; start + windowLength < channel.length; start += step) {
      let energy = 0;
      for (let i = 0; i < windowLength; i += 16) energy += channel[start + i] ** 2;
      if (energy > bestEnergy) { bestEnergy = energy; bestStart = start; }
    }
    const next = new Float32Array(SAMPLE_COUNT);
    for (let i = 0; i < SAMPLE_COUNT; i++) next[i] = channel[bestStart + Math.floor(i / SAMPLE_COUNT * windowLength)] || 0;
    let mean = 0;
    next.forEach((v) => { mean += v; });
    mean /= SAMPLE_COUNT;
    next.forEach((_, i) => { next[i] -= mean; });
    state.signal = normalize(next);
    state.hasDrawing = true;
    $("#file-status").textContent = `${label} · ${decoded.duration.toFixed(1)} sec · analyzed locally`;
    analyzeSignal();
  }

  async function recordSample(button) {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      $("#file-status").textContent = "Recording is not supported in this browser. Try choosing an audio file.";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        button.classList.remove("recording");
        $("[data-record-label]", button).textContent = "Record 2 seconds";
        const blob = new Blob(chunks, { type: recorder.mimeType });
        try { await importAudioBuffer(await blob.arrayBuffer(), "Microphone sample"); }
        catch { $("#file-status").textContent = "That recording could not be decoded. Try an audio file instead."; }
      };
      recorder.start();
      button.classList.add("recording");
      $("[data-record-label]", button).textContent = "Listening…";
      $("#file-status").textContent = "Recording for two seconds…";
      window.setTimeout(() => recorder.state === "recording" && recorder.stop(), 2000);
    } catch {
      $("#file-status").textContent = "Microphone access was not available. You can still choose an audio file.";
    }
  }

  function audioBufferFromSignal() {
    const context = state.audioContext;
    const duration = Math.max(1 / state.fundamental, .004);
    const cycleFrames = Math.max(8, Math.round(context.sampleRate * duration));
    const buffer = context.createBuffer(1, cycleFrames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < cycleFrames; i++) {
      const position = i / cycleFrames * SAMPLE_COUNT;
      const low = Math.floor(position) % SAMPLE_COUNT;
      const high = (low + 1) % SAMPLE_COUNT;
      const mix = position - Math.floor(position);
      data[i] = state.signal[low] * (1 - mix) + state.signal[high] * mix;
    }
    return buffer;
  }

  async function startAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audioContext ||= new AudioContext();
    await state.audioContext.resume();
    const source = state.audioContext.createBufferSource();
    const gain = state.audioContext.createGain();
    source.buffer = audioBufferFromSignal();
    source.loop = true;
    gain.gain.setValueAtTime(0, state.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(Number($("#volume").value) * .45, state.audioContext.currentTime + .03);
    source.connect(gain).connect(state.audioContext.destination);
    source.start();
    state.source = source;
    state.gain = gain;
    state.playing = true;
    $("[data-play]").classList.add("playing");
    $("[data-play]").setAttribute("aria-label", "Pause signal");
    $("[data-play-status]").textContent = "PLAYING YOUR SIGNAL";
  }

  function stopAudio() {
    if (state.source) {
      try { state.source.stop(); } catch { /* already stopped */ }
      state.source.disconnect();
    }
    state.source = null;
    state.playing = false;
    $("[data-play]").classList.remove("playing");
    $("[data-play]").setAttribute("aria-label", "Play signal");
    $("[data-play-status]").textContent = "HEAR THIS SIGNAL";
  }

  function restartAudio() {
    if (!state.playing) return;
    stopAudio();
    startAudio();
  }

  function reset() {
    state.hasDrawing = false;
    document.body.classList.remove("has-drawing");
    if (state.mode === "build") preset("sine");
    else {
      state.signal = new Float32Array(SAMPLE_COUNT);
      analyzeSignal();
      $("#file-status").textContent = "No sample loaded yet.";
    }
  }

  $$(".mode-tab").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  $$(".preset").forEach((button) => button.addEventListener("click", () => preset(button.dataset.preset)));
  $("#fundamental").addEventListener("input", (event) => { state.fundamental = Number(event.target.value); updateReadouts(); restartAudio(); });
  harmonicControls.addEventListener("input", (event) => {
    const index = Number(event.target.dataset.harmonic);
    if (!Number.isInteger(index)) return;
    state.amplitudes[index] = Number(event.target.value);
    event.target.nextElementSibling.textContent = `${Math.round(state.amplitudes[index] * 100)}%`;
    $$(".preset").forEach((button) => button.classList.remove("active"));
    buildSignal();
    coachSay(`You changed harmonic ${index + 1}. Check bar ${index + 1} in the spectrum, then look for the new detail in the waveform.`, "NOTICE THIS");
  });
  $("#terms").addEventListener("input", (event) => {
    state.terms = Number(event.target.value);
    updateReadouts();
    draw();
    coachSay(`You kept ${state.terms} frequencies, so the rebuild now matches ${Math.round(matchAccuracy(reconstruct()))}%. Watch which details return as you move right.`, "NOTICE THIS");
  });
  $("#volume").addEventListener("input", (event) => { if (state.gain) state.gain.gain.setTargetAtTime(Number(event.target.value) * .45, state.audioContext.currentTime, .015); });
  $("[data-play]").addEventListener("click", () => state.playing ? stopAudio() : startAudio());
  $("[data-reset]").addEventListener("click", reset);
  $("[data-smooth]").addEventListener("click", smoothSignal);
  $("[data-random]").addEventListener("click", randomSignal);
  $("[data-record]").addEventListener("click", (event) => recordSample(event.currentTarget));
  $("#audio-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    $("#file-status").textContent = `Reading ${file.name}…`;
    try { await importAudioBuffer(await file.arrayBuffer(), file.name); }
    catch { $("#file-status").textContent = "That file could not be decoded. Try another audio format."; }
  });
  $("#coach-form").addEventListener("submit", (event) => {
    event.preventDefault();
    applyCoachPrompt($("#coach-input").value);
  });
  $$('[data-coach-prompt]').forEach((button) => button.addEventListener("click", () => {
    $("#coach-input").value = button.dataset.coachPrompt;
    applyCoachPrompt(button.dataset.coachPrompt);
  }));
  $$('[data-coach-action]').forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.coachAction === "explain") explainSignal();
    if (button.dataset.coachAction === "quiz") startQuiz();
    if (button.dataset.coachAction === "hint") giveHint();
  }));
  waveformWrap.addEventListener("pointerdown", (event) => {
    if (state.mode !== "draw") return;
    state.drawing = true; previousPoint = null; waveformWrap.setPointerCapture(event.pointerId); drawPointer(event);
  });
  waveformWrap.addEventListener("pointermove", drawPointer);
  waveformWrap.addEventListener("pointerup", () => { state.drawing = false; previousPoint = null; });
  waveformWrap.addEventListener("pointercancel", () => { state.drawing = false; previousPoint = null; });
  spectrumCanvas.addEventListener("pointerdown", (event) => {
    const rect = spectrumCanvas.getBoundingClientRect();
    state.selectedBin = Math.max(0, Math.min(MAX_BINS - 1, Math.floor((event.clientX - rect.left) / rect.width * MAX_BINS)));
    updateReadouts(); drawSpectrum();
  });
  $("[data-next-lesson]").addEventListener("click", () => {
    state.lesson = (state.lesson + 1) % lessons.length;
    $("#lesson-index").textContent = String(state.lesson + 1).padStart(2, "0");
    $("#lesson-kicker").textContent = lessons[state.lesson][0];
    $("#lesson-text").textContent = lessons[state.lesson][1];
  });
  const dialog = $("#about-dialog");
  $("[data-open-about]").addEventListener("click", () => dialog.showModal());
  $$('[data-close-about]').forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  window.addEventListener("resize", draw);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAudio(); });

  createHarmonicControls();
  buildSignal();
})();
