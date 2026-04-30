// Encrypts a source HTML file with AES-256-GCM using a password.
// Usage: node build-encrypted.mjs <source.html> <password> <output.html> "<page title>"
//
// The output is a small unlock page that:
//   1. Asks for the password
//   2. Derives a key with PBKDF2 (600,000 iterations of SHA-256)
//   3. Decrypts the embedded ciphertext via Web Crypto
//   4. Replaces document.documentElement with the decrypted HTML
//   5. Caches the password in sessionStorage so subsequent loads in the same tab session are instant
//
// Crypto choices match what Web Crypto can do natively in the browser
// so the unlock page has zero external dependencies.

import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, pbkdf2Sync, createCipheriv } from "node:crypto";

const [, , srcPath, password, outPath, pageTitle] = process.argv;
if (!srcPath || !password || !outPath) {
  console.error("usage: node build-encrypted.mjs <src> <password> <out> [title]");
  process.exit(1);
}

const PBKDF2_ITERATIONS = 600_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const html = readFileSync(srcPath, "utf8");

const salt = randomBytes(SALT_BYTES);
const iv = randomBytes(IV_BYTES);
const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");

const cipher = createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(html, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
const payload = Buffer.concat([ciphertext, tag]).toString("base64");

const title = pageTitle || "Locked";

const unlock = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{
    background:#0a0a0f;color:#e4e4ef;
    font-family:-apple-system,'Inter',sans-serif;
    display:flex;align-items:center;justify-content:center;
    background-image:
      linear-gradient(rgba(99,102,241,0.025) 1px,transparent 1px),
      linear-gradient(90deg,rgba(99,102,241,0.025) 1px,transparent 1px);
    background-size:60px 60px;
  }
  .box{
    background:#12121a;border:1px solid #1e1e2e;border-radius:18px;
    padding:36px 32px;max-width:380px;width:calc(100% - 32px);
    box-shadow:0 12px 40px rgba(0,0,0,0.4);
  }
  .lock{font-size:30px;margin-bottom:14px;text-align:center}
  h1{font-size:18px;font-weight:700;margin-bottom:6px;text-align:center}
  p{font-size:13px;color:#8888a0;text-align:center;margin-bottom:22px;line-height:1.5}
  form{display:flex;flex-direction:column;gap:10px}
  input{
    padding:12px 14px;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:10px;
    color:#e4e4ef;font-size:14px;font-family:inherit;outline:none;
    transition:border-color .15s,box-shadow .15s;
  }
  input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,0.15)}
  button{
    padding:12px;background:#6366f1;color:white;border:none;border-radius:10px;
    font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;
    transition:background .15s;
  }
  button:hover{background:#7479ff}
  button:disabled{opacity:.5;cursor:wait}
  .err{color:#ff6168;font-size:12px;text-align:center;margin-top:6px;min-height:14px}
  /* Default-hidden so a synchronous head script can decide what to show before paint */
  #ui{display:none}
  #spinner{display:none}
  .spinner{
    width:36px;height:36px;border-radius:50%;
    border:3px solid rgba(99,102,241,0.15);border-top-color:#6366f1;
    animation:spin .8s linear infinite;
  }
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
<script>
  // Synchronous: decide *before* paint whether to show unlock UI or spinner.
  // Avoids a flash of the password box on refresh when we have a cached password.
  (function(){
    var SS_KEY = "japan2026.pw";
    var cached = null;
    try { cached = sessionStorage.getItem(SS_KEY); } catch (e) {}
    // Inject a tiny <style> override before the body paints.
    var s = document.createElement("style");
    if (cached) {
      s.textContent = "#spinner{display:flex !important}";
    } else {
      s.textContent = "#ui{display:block !important}";
    }
    document.head.appendChild(s);
  })();
</script>
</head>
<body>
<noscript><div class="box"><h1>JavaScript required</h1><p>This page is encrypted and needs JavaScript to decrypt.</p></div></noscript>
<div id="spinner" style="align-items:center;justify-content:center"><div class="spinner"></div></div>
<div class="box" id="ui">
  <div class="lock">🔒</div>
  <h1>${title}</h1>
  <p>Enter password to view trip details.</p>
  <form id="f" autocomplete="off">
    <input id="pw" type="password" placeholder="Password" autofocus required>
    <button id="go" type="submit">Unlock</button>
    <div class="err" id="err"></div>
  </form>
</div>
<script>
(() => {
  const SALT_B64 = ${JSON.stringify(salt.toString("base64"))};
  const IV_B64   = ${JSON.stringify(iv.toString("base64"))};
  const PAYLOAD_B64 = ${JSON.stringify(payload)};
  const ITER = ${PBKDF2_ITERATIONS};
  const SS_KEY = "japan2026.pw";

  const b64ToBuf = b64 => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  async function tryUnlock(pw) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw", enc.encode(pw), {name:"PBKDF2"}, false, ["deriveKey"]
    );
    const aesKey = await crypto.subtle.deriveKey(
      {name:"PBKDF2", salt:b64ToBuf(SALT_B64), iterations:ITER, hash:"SHA-256"},
      baseKey,
      {name:"AES-GCM", length:256},
      false, ["decrypt"]
    );
    const plain = await crypto.subtle.decrypt(
      {name:"AES-GCM", iv:b64ToBuf(IV_B64)},
      aesKey,
      b64ToBuf(PAYLOAD_B64)
    );
    return new TextDecoder().decode(plain);
  }

  function render(html) {
    document.open();
    document.write(html);
    document.close();
  }

  async function attempt(pw, persist) {
    const errEl = document.getElementById("err");
    const btn = document.getElementById("go");
    if (errEl) errEl.textContent = "";
    if (btn) btn.disabled = true;
    try {
      const html = await tryUnlock(pw);
      if (persist) {
        try { sessionStorage.setItem(SS_KEY, pw); } catch {}
      }
      render(html);
    } catch (e) {
      try { sessionStorage.removeItem(SS_KEY); } catch {}
      // Hide spinner (cached path) and reveal the unlock box.
      const sp = document.getElementById("spinner");
      if (sp) sp.style.display = "none";
      const ui = document.getElementById("ui");
      if (ui) ui.style.display = "block";
      if (errEl) errEl.textContent = "Wrong password.";
      if (btn) btn.disabled = false;
      const pwEl = document.getElementById("pw");
      if (pwEl) { pwEl.value = ""; pwEl.focus(); }
    }
  }

  // Auto-unlock on page load if we already have the password this session
  let cached = null;
  try { cached = sessionStorage.getItem(SS_KEY); } catch {}
  if (cached) {
    attempt(cached, false);
  }

  document.getElementById("f").addEventListener("submit", e => {
    e.preventDefault();
    const pw = document.getElementById("pw").value;
    attempt(pw, true);
  });
})();
</script>
</body>
</html>
`;

writeFileSync(outPath, unlock);
console.log(`encrypted: ${srcPath} → ${outPath} (${(payload.length / 1024).toFixed(1)} KB ciphertext)`);
