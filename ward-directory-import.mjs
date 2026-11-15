import { getDocument, GlobalWorkerOptions, OPS, Util } from "./assets/ward-directory-pdfjs/pdf.min.mjs";

GlobalWorkerOptions.workerSrc = new URL("./assets/ward-directory-pdfjs/pdf.worker.min.mjs", import.meta.url).href;

const columns = [
  { photo: 89, name: 120.8 },
  { photo: 260, name: 291.7 },
  { photo: 345, name: 377.2 },
  { photo: 430, name: 462.7 },
];
const identity = [1, 0, 0, 1, 0, 0];
const near = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;

function locatePortraits({ fnArray, argsArray }) {
  let matrix = identity;
  const stack = [];
  const portraits = [];
  for (let i = 0; i < fnArray.length; i++) {
    const operation = fnArray[i];
    const args = argsArray[i];
    if (operation === OPS.save || operation === OPS.paintFormXObjectBegin) stack.push(matrix);
    if (operation === OPS.transform) matrix = Util.transform(matrix, args);
    if (operation === OPS.paintFormXObjectBegin && args[0]) matrix = Util.transform(matrix, args[0]);
    if (operation === OPS.restore || operation === OPS.paintFormXObjectEnd) matrix = stack.pop() ?? identity;
    if (operation !== OPS.paintImageXObject) continue;

    const [width, skewY, skewX, height, x, y] = matrix;
    if (!width || !height || skewX || skewY) continue;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const column = columns.find(entry => near(centerX, entry.photo, 10));
    if (!column || Math.min(Math.abs(width), Math.abs(height)) < 35 || Math.max(Math.abs(width), Math.abs(height)) > 155) continue;
    portraits.push({ column, centerY, box: [x, y, x + width, y + height] });
  }
  return portraits;
}

function matchNames(items, portraits) {
  const names = [];
  const households = [];
  for (const item of items) {
    const value = item.str?.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    if (near(item.height, 11.7, .3) && near(x, 44, 3) && value.includes(",")) {
      households.push({ y, surname: value.split(",")[0].trim() });
    } else if (near(item.height, 9.6, .3) && columns.some(column => near(x, column.name, 3)) && /\p{L}/u.test(value) && !/[@\d]/.test(value)) {
      names.push({ x, y, value });
    }
  }
  households.sort((a, b) => a.y - b.y);
  const matches = [];
  const used = new Set();
  for (const portrait of portraits) {
    const match = names
      .filter(name => near(name.x, portrait.column.name, 3) && near(name.y, portrait.centerY, 12))
      .sort((a, b) => Math.abs(a.y - portrait.centerY) - Math.abs(b.y - portrait.centerY))[0];
    if (!match || used.has(match)) continue;
    const household = households.find(header => header.y > match.y);
    if (!household) continue;
    used.add(match);
    const suffix = household.surname;
    const name = match.value.toLocaleLowerCase().endsWith(" " + suffix.toLocaleLowerCase())
      ? match.value
      : match.value + " " + suffix;
    matches.push({ name, box: portrait.box });
  }
  return { matches, nameCount: names.length };
}

async function cropPortrait(source, viewport, box, crop) {
  const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(box);
  const left = Math.round(Math.min(x1, x2));
  const top = Math.round(Math.min(y1, y2));
  const width = Math.round(Math.max(x1, x2)) - left;
  const height = Math.round(Math.max(y1, y2)) - top;
  if (width < 1 || height < 1 || left < 0 || top < 0 || left + width > source.width || top + height > source.height) return null;
  crop.width = width;
  crop.height = height;
  crop.getContext("2d", { alpha: false }).drawImage(source, left, top, width, height, 0, 0, width, height);
  return new Promise(resolve => crop.toBlob(resolve, "image/jpeg", .87));
}

export async function readWardDirectory(file, onPage) {
  if (file.size > 40 * 1024 * 1024) throw new Error("Choose a directory PDF under 40 MB.");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useWasm: false,
    useWorkerFetch: false,
    disableFontFace: true,
    maxImageSize: 4_000_000,
  });
  const source = document.createElement("canvas");
  const crop = document.createElement("canvas");
  const cards = [];
  let nameCount = 0;
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error("Choose a directory PDF with 100 pages or fewer.");
    for (let number = 1; number <= pdf.numPages; number++) {
      onPage(number, pdf.numPages);
      const page = await pdf.getPage(number);
      try {
        const original = page.getViewport({ scale: 1 });
        if (!near(original.width, 612, 3) || !near(original.height, 792, 3) || page.rotate !== 0) continue;
        const [text, operations] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
        const { matches, nameCount: onPageCount } = matchNames(text.items, locatePortraits(operations));
        nameCount += onPageCount;
        if (!matches.length) continue;

        const viewport = page.getViewport({ scale: 4 });
        source.width = Math.ceil(viewport.width);
        source.height = Math.ceil(viewport.height);
        await page.render({ canvas: source, viewport }).promise;
        for (const [index, match] of matches.entries()) {
          const photo = await cropPortrait(source, viewport, match.box, crop);
          if (!photo) continue;
          cards.push({ id: "ward-pdf:" + fingerprint + ":" + number + ":" + index, name: match.name.slice(0, 120), photo });
        }
      } finally {
        page.cleanup();
      }
    }
    if (!cards.length) throw new Error("No individual portraits were found. Use a Ward Directory and Map PDF that includes photos.");
    return { cards, missingPhotos: Math.max(0, nameCount - cards.length) };
  } finally {
    source.width = source.height = crop.width = crop.height = 0;
    await task.destroy();
  }
}
