"use strict";

const $ = id => document.getElementById(id);
const database = indexedDB.open("personal-pages-ward-names", 1);
const groups = { unlisted: "Everyone only", men: "Men", women: "Women" };
const maxCards = 750;
const maxPhotoSize = 128 * 1024;
let db;
let cards = [];
let filter = "all";
let shownId;
let photoUrl;
let current;
let prior;
let editing;
let drag;
let skipClick = false;
let busy = false;
const batch = new Map();

database.onupgradeneeded = () => database.result.createObjectStore("deck");
database.onerror = () => showStorageError();
database.onsuccess = () => {
  db = database.result;
  const read = db.transaction("deck").objectStore("deck").get("cards");
  read.onerror = showStorageError;
  read.onsuccess = () => {
    cards = read.result ?? [];
    render();
  };
};

function showStorageError() {
  $("empty-title").textContent = "This browser couldn’t open your deck";
  $("empty-text").textContent = "Allow site storage, then reload to use your photo deck.";
  $("manage").disabled = true;
}

async function save(next) {
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("deck", "readwrite");
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore("deck").put(next, "cards");
  });
  cards = next;
}

function reveal(flipped) {
  const card = $("card");
  card.setAttribute("aria-pressed", flipped);
  card.setAttribute("aria-label", flipped ? current.name + ". Show photo" : "Reveal name");
  $("front").setAttribute("aria-hidden", flipped);
  $("back").setAttribute("aria-hidden", !flipped);
  $("answer").textContent = flipped ? current.name : "";
}

function render() {
  const filtered = cards.filter(card => filter === "all" || card.group === filter);
  const learned = filtered.filter(card => card.learned).length;
  const remaining = filtered.length - learned;
  current = filtered.find(card => !card.learned);
  $("progress").textContent = filtered.length ? learned + " of " + filtered.length + " remembered" : "";
  $("meter").max = filtered.length || 1;
  $("meter").value = learned;
  $("meter").hidden = !filtered.length;
  $("undo").hidden = !prior;
  $("stage").hidden = $("grading").hidden = !current;
  $("empty").hidden = !!current;
  $("empty-action").hidden = !!current;
  if (shownId !== current?.id) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = current ? URL.createObjectURL(current.photo) : undefined;
    if (photoUrl) $("portrait").src = photoUrl;
    else $("portrait").removeAttribute("src");
    reveal(false);
    shownId = current?.id;
  }
  if (!cards.length) {
    $("empty-title").textContent = "Start with a familiar face";
    $("empty-text").textContent = "Add individual photos and names to build your ward deck.";
    $("empty-action").textContent = "Add your first card";
    $("empty-action").onclick = openDeck;
  } else if (!filtered.length) {
    $("empty-title").textContent = "No cards in this group";
    $("empty-text").textContent = "Add a card to this group or practice everyone.";
    $("empty-action").textContent = "Show everyone";
    $("empty-action").onclick = () => setFilter("all");
  } else if (!remaining) {
    $("empty-title").textContent = "You remembered every name";
    $("empty-text").textContent = "You finished " + (filter === "all" ? "the whole deck." : "this group.");
    $("empty-action").textContent = "Practice this group again";
    $("empty-action").onclick = () => resetProgress(filter);
  }
  if ($("deck-dialog").open) renderDeck();
}

function setFilter(value) {
  filter = value;
  for (const button of $("filters").querySelectorAll("button")) {
    button.setAttribute("aria-pressed", button.dataset.filter === filter);
  }
  $("feedback").textContent = "";
  reveal(false);
  render();
}

async function grade(remembered) {
  if (busy || !current) return;
  const previous = cards;
  const reviewed = current;
  const sameCard = cards.findIndex(card => card.id === reviewed.id);
  const next = [...cards];
  if (remembered) next[sameCard] = { ...reviewed, learned: true };
  else next.push(...next.splice(sameCard, 1));
  busy = true;
  try {
    await save(next);
    prior = previous;
    reveal(false);
    $("feedback").textContent = remembered ? "Marked as remembered." : "This card will come back.";
    render();
  } catch {
    $("feedback").textContent = "Progress couldn’t be saved. Try again.";
  } finally {
    busy = false;
  }
}

async function undo() {
  if (busy || !prior) return;
  busy = true;
  try {
    await save(prior);
    prior = undefined;
    $("feedback").textContent = "Last swipe undone.";
    render();
  } catch {
    $("feedback").textContent = "The last swipe couldn’t be undone.";
  } finally {
    busy = false;
  }
}

function clearDrag() {
  drag = undefined;
  $("card").classList.remove("dragging");
  $("card").style.transform = "";
  $("swipe-label").textContent = "";
}

$("card").addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0 || busy) return;
  skipClick = false;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  $("card").setPointerCapture(event.pointerId);
});
$("card").addEventListener("pointermove", event => {
  if (event.pointerId !== drag?.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy))) return;
  drag.moved = true;
  $("card").classList.add("dragging");
  $("card").style.transform = "translateX(" + dx + "px) rotate(" + Math.max(-16, Math.min(16, dx / 11)) + "deg)";
  $("swipe-label").textContent = dx > 0 ? "Remembered" : "Try again";
  $("swipe-label").classList.toggle("remember", dx > 0);
});
$("card").addEventListener("pointerup", event => {
  if (event.pointerId !== drag?.id) return;
  const dx = event.clientX - drag.x;
  skipClick = !!drag.moved;
  clearDrag();
  if (skipClick && Math.abs(dx) >= Math.min(90, $("card").offsetWidth * .22)) grade(dx > 0);
});
$("card").addEventListener("pointercancel", clearDrag);
$("card").addEventListener("lostpointercapture", clearDrag);
$("card").addEventListener("click", event => {
  if (skipClick && event.detail !== 0) return;
  if (current && !busy) reveal($("card").getAttribute("aria-pressed") !== "true");
});
$("again").onclick = () => grade(false);
$("got").onclick = () => grade(true);
$("undo").onclick = undo;
$("filters").onclick = event => {
  const value = event.target.closest("button")?.dataset.filter;
  if (value) setFilter(value);
};
document.addEventListener("keydown", event => {
  if ($("deck-dialog").open || !current || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  grade(event.key === "ArrowRight");
});

function openDeck() {
  if (!db || busy) return;
  $("deck-status").textContent = "";
  $("deck-dialog").showModal();
  renderDeck();
}

function resetForm() {
  editing = undefined;
  $("member-form").reset();
  $("member-photo").required = true;
  $("save-member").textContent = "Add card";
  $("cancel-edit").hidden = true;
}

$("manage").onclick = openDeck;
$("close-deck").onclick = () => $("deck-dialog").close();
$("deck-dialog").addEventListener("close", resetForm);
$("cancel-edit").onclick = resetForm;
$("search").oninput = renderDeck;

function renderDeck() {
  const query = $("search").value.trim().toLocaleLowerCase();
  $("export").disabled = !cards.length;
  $("reset").disabled = !cards.some(card => card.learned);
  $("search-label").hidden = !cards.length;
  $("members").replaceChildren();
  const sorted = [...cards].sort((a, b) => a.name.localeCompare(b.name));
  for (const card of sorted) {
    if (!card.name.toLocaleLowerCase().includes(query)) continue;
    const row = document.createElement("li");
    const label = document.createElement("div");
    label.className = "members-name";
    label.textContent = card.name;
    const status = document.createElement("small");
    status.textContent = groups[card.group] + " · " + (card.learned ? "Remembered" : "To practice");
    label.append(status);
    const actions = document.createElement("div");
    actions.className = "members-actions";
    for (const [action, handler] of [["Edit", () => editCard(card)], ["Remove", () => removeCard(card)]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action;
      button.setAttribute("aria-label", action + " " + card.name);
      button.onclick = handler;
      actions.append(button);
    }
    row.append(label, actions);
    $("members").append(row);
  }
}

function editCard(card) {
  if (busy) return;
  editing = card;
  $("member-name").value = card.name;
  $("member-group").value = card.group;
  $("member-photo").value = "";
  $("member-photo").required = false;
  $("cancel-edit").hidden = false;
  $("save-member").textContent = "Save changes";
  $("member-name").focus();
}

async function changeDeck(next, message) {
  await save(next);
  prior = undefined;
  $("deck-status").textContent = message;
  $("feedback").textContent = "";
  reveal(false);
  render();
}

async function removeCard(card) {
  if (busy || !confirm("Remove " + card.name + " from this deck?")) return;
  busy = true;
  try {
    await changeDeck(cards.filter(item => item.id !== card.id), "Card removed.");
    if (editing?.id === card.id) resetForm();
  } catch {
    $("deck-status").textContent = "The card couldn’t be removed.";
  } finally {
    busy = false;
  }
}

async function resetProgress(group) {
  if (busy || !confirm("Start over for " + (group === "all" ? "everyone" : groups[group].toLowerCase()) + "?")) return;
  busy = true;
  try {
    await changeDeck(cards.map(card => group === "all" || card.group === group ? { ...card, learned: false } : card), "Progress reset.");
  } catch {
    ($("deck-dialog").open ? $("deck-status") : $("feedback")).textContent = "Progress couldn’t be reset.";
  } finally {
    busy = false;
  }
}

$("reset").onclick = () => resetProgress("all");

async function preparePhoto(file) {
  if (!file || file.size > 25 * 1024 * 1024 || file.type === "image/svg+xml") {
    throw new Error("Choose a photo under 25 MB.");
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 580 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.8, .65, .5, .35]) {
      const photo = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (photo && photo.size <= maxPhotoSize) return photo;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  throw new Error("This photo could not be prepared. Try a smaller JPEG or PNG.");
}

$("member-form").onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  const name = $("member-name").value.trim();
  const group = $("member-group").value;
  if (!name) {
    $("deck-status").textContent = "Enter a name for this card.";
    return;
  }
  if (!editing && cards.length >= maxCards) {
    $("deck-status").textContent = "This deck has reached its " + maxCards + " card limit.";
    return;
  }
  busy = true;
  $("save-member").disabled = true;
  try {
    const file = $("member-photo").files[0];
    const original = editing;
    const photo = file ? await preparePhoto(file) : original?.photo;
    if (!photo) throw new Error("Choose an individual photo.");
    const updated = { id: original?.id ?? crypto.randomUUID(), name, group, photo, learned: original?.learned ?? false };
    const next = original ? cards.map(card => card.id === original.id ? updated : card) : [...cards, updated];
    if (shownId === updated.id) shownId = undefined;
    await changeDeck(next, original ? "Card updated." : "Card added.");
    resetForm();
    $("member-name").focus();
  } catch (error) {
    $("deck-status").textContent = error?.message || "The card couldn’t be saved. Try a JPEG or PNG photo.";
  } finally {
    busy = false;
    $("save-member").disabled = false;
  }
};

function photoLabel(filename) {
  const stem = filename.replace(/\.[^.]+$/, "");
  const prefix = stem.match(/^(women|men)\s*[-_]\s*/i);
  const name = stem.slice(prefix?.[0].length ?? 0).replace(/_+/g, " ").trim();
  return { name: name.slice(0, 120), group: prefix?.[1].toLowerCase() ?? "unlisted" };
}

function updateBatch() {
  $("batch-form").hidden = !batch.size;
  $("batch-submit").textContent = "Add " + batch.size + (batch.size === 1 ? " card" : " cards");
  $("batch-hint").hidden = Array.from(batch.values()).some(selection => selection.id);
}

function discardPhoto(key) {
  const selection = batch.get(key);
  URL.revokeObjectURL(selection.url);
  selection.row.remove();
  batch.delete(key);
}

$("choose-photos").onclick = () => {
  if (!busy) $("batch-files").click();
};

function queuePhoto(key, file, { name, group, label, id }) {
  const row = $("batch-row").content.firstElementChild.cloneNode(true);
  const url = URL.createObjectURL(file);
  const nameField = row.querySelector(".batch-name");
  const groupField = row.querySelector(".batch-person-group");
  nameField.value = name;
  groupField.value = group;
  row.querySelector("img").src = url;
  const remove = row.querySelector(".batch-remove");
  remove.setAttribute("aria-label", "Remove " + label + " from batch");
  remove.onclick = () => {
    discardPhoto(key);
    updateBatch();
    if (!batch.size) $("choose-photos").focus();
  };
  $("batch-rows").append(row);
  batch.set(key, { file, row, url, nameField, groupField, id });
}

$("batch-files").onchange = event => {
  const files = [...event.target.files];
  event.target.value = "";
  if (busy || !files.length) return;
  let skipped = 0;
  for (const file of files) {
    const key = JSON.stringify([file.name, file.size, file.lastModified]);
    if (batch.has(key)) continue;
    if (cards.length + batch.size >= maxCards) {
      skipped++;
      continue;
    }
    queuePhoto(key, file, { ...photoLabel(file.name), label: file.name });
  }
  $("deck-status").textContent = skipped ? "The deck holds up to " + maxCards + " cards. " + skipped + " photos couldn’t be queued." : "";
  $("batch-status").textContent = "";
  updateBatch();
};

$("choose-directory").onclick = () => {
  if (!busy) $("directory-file").click();
};

$("directory-file").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (busy || !file) return;
  busy = true;
  $("close-deck").disabled = $("batch-fields").disabled = true;
  $("deck-status").textContent = "Opening directory PDF…";
  try {
    const { readWardDirectory } = await import("./ward-directory-import.mjs");
    const result = await readWardDirectory(file, (page, total) => {
      $("deck-status").textContent = "Reading PDF page " + page + " of " + total + "…";
    });
    const savedIds = new Set(cards.map(card => card.id));
    let queued = 0;
    let duplicates = 0;
    let skipped = 0;
    for (const { id, name, photo } of result.cards) {
      if (savedIds.has(id) || batch.has(id)) duplicates++;
      else if (cards.length + batch.size >= maxCards) skipped++;
      else {
        queuePhoto(id, photo, { name, id, group: "unlisted", label: name });
        queued++;
      }
    }
    const summary = [queued + (queued === 1 ? " photo card ready to review." : " photo cards ready to review.")];
    if (result.missingPhotos) summary.push(result.missingPhotos + " names without a matched photo were skipped.");
    if (duplicates) summary.push(duplicates + " cards from this PDF were already saved or queued.");
    if (skipped) summary.push(skipped + " cards would exceed the deck limit.");
    if (queued) summary.push("Review the names and assign groups as needed.");
    $("deck-status").textContent = summary.join(" ");
    $("batch-status").textContent = "";
    updateBatch();
  } catch (error) {
    $("deck-status").textContent = error?.message || "This directory PDF couldn’t be read.";
  } finally {
    busy = false;
    $("close-deck").disabled = $("batch-fields").disabled = false;
  }
};

$("batch-apply-group").onclick = () => {
  for (const selection of batch.values()) selection.groupField.value = $("batch-group").value;
};

$("batch-clear").onclick = () => {
  for (const key of batch.keys()) discardPhoto(key);
  $("batch-status").textContent = "";
  updateBatch();
  $("choose-photos").focus();
};

$("batch-form").onsubmit = async event => {
  event.preventDefault();
  if (busy || !batch.size) return;
  for (const { nameField } of batch.values()) {
    if (nameField.value.trim()) continue;
    nameField.value = "";
    nameField.reportValidity();
    return;
  }
  if (cards.length + batch.size > maxCards) {
    $("batch-status").textContent = "Remove some cards or photos to stay within the " + maxCards + " card limit.";
    return;
  }
  busy = true;
  $("batch-fields").disabled = true;
  $("close-deck").disabled = true;
  const prepared = [];
  try {
    let processed = 0;
    for (const [key, { file, row, nameField, groupField, id }] of batch) {
      const error = row.querySelector(".batch-error");
      error.hidden = true;
      $("batch-status").textContent = "Preparing photo " + ++processed + " of " + batch.size + "…";
      try {
        const photo = id && file.size <= maxPhotoSize ? file : await preparePhoto(file);
        prepared.push({ key, card: { id: id ?? crypto.randomUUID(), name: nameField.value.trim(), group: groupField.value, photo, learned: false } });
      } catch {
        error.textContent = "Couldn’t read this photo. Try a JPEG or PNG under 25 MB.";
        error.hidden = false;
      }
    }
    if (prepared.length) {
      const added = prepared.map(entry => entry.card);
      await changeDeck([...cards, ...added], "Added " + added.length + (added.length === 1 ? " card." : " cards."));
      for (const { key } of prepared) discardPhoto(key);
    }
    $("batch-status").textContent = batch.size ? "Some photos couldn’t be added. Check the remaining rows." : "";
    updateBatch();
    if (!batch.size) $("choose-photos").focus();
  } catch {
    $("batch-status").textContent = "The batch couldn’t be saved. Your selection is still here.";
  } finally {
    busy = false;
    $("batch-fields").disabled = false;
    $("close-deck").disabled = false;
  }
};

$("deck-dialog").addEventListener("cancel", event => {
  if ($("batch-fields").disabled) event.preventDefault();
});

function asDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

$("export").onclick = async () => {
  if (busy) return;
  busy = true;
  try {
    const exported = [];
    for (const card of cards) exported.push({ ...card, photo: await asDataUrl(card.photo) });
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, cards: exported })], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ward-name-practice-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    $("deck-status").textContent = "Backup downloaded. It contains the names and photos in this deck.";
  } catch {
    $("deck-status").textContent = "The backup couldn’t be created.";
  } finally {
    busy = false;
  }
};

$("import").onclick = () => $("import-file").click();
$("import-file").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (busy || !file) return;
  busy = true;
  try {
    if (file.size > maxCards * (maxPhotoSize * 1.34 + 1024)) throw new Error("The deck file is too large.");
    const deck = JSON.parse(await file.text());
    if (deck?.version !== 1 || !Array.isArray(deck.cards) || !deck.cards.length || deck.cards.length > maxCards) {
      throw new Error("Choose a Ward Name Practice backup containing cards.");
    }
    const imported = [];
    const knownIds = new Set();
    for (const card of deck.cards) {
      const name = typeof card?.name === "string" ? card.name.trim() : "";
      const photoData = typeof card?.photo === "string" && card.photo.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!name || name.length > 120 || !photoData || photoData[2].length > maxPhotoSize * 1.34 || !Object.hasOwn(groups, card.group)) {
        throw new Error("The backup contains a card with an invalid name, group, or photo.");
      }
      const bytes = Uint8Array.from(atob(photoData[2]), char => char.charCodeAt(0));
      const photo = new Blob([bytes], { type: "image/" + photoData[1] });
      const normalized = await preparePhoto(photo);
      const id = typeof card.id === "string" && card.id.length <= 100 && card.id && !knownIds.has(card.id) ? card.id : crypto.randomUUID();
      knownIds.add(id);
      imported.push({ id, name, group: card.group, photo: normalized, learned: card.learned === true });
    }
    if (cards.length && !confirm("Replace this browser’s deck and progress with the imported deck?")) return;
    shownId = undefined;
    await changeDeck(imported, "Imported " + imported.length + " cards.");
    resetForm();
  } catch (error) {
    $("deck-status").textContent = error instanceof SyntaxError ? "The deck file isn’t valid JSON." : (error?.message || "The backup couldn’t be imported.");
  } finally {
    busy = false;
  }
};
