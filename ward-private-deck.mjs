const encryptedDeck = new URL("./assets/ward-practice-deck-v1.enc", import.meta.url);

export async function readPrivateDeck(secret) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new Error("That private deck link is incomplete. Open the original link again.");
  const keyBytes = Uint8Array.from(atob(secret.replace(/-/g, "+").replace(/_/g, "/") + "="), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  keyBytes.fill(0);
  const response = await fetch(encryptedDeck, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("The private deck couldn’t be downloaded. Refresh to try again.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
  } catch {
    throw new Error("This link couldn’t unlock the ward deck. Open the original link again.");
  }
  const deck = JSON.parse(new TextDecoder().decode(plaintext));
  if (deck?.version !== 1 || !Array.isArray(deck.cards)) throw new Error("This private deck isn’t in a supported format.");
  return deck.cards.map(({ id, name, group, photo }) => {
    const encoded = photo.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!encoded) throw new Error("A photo in the private deck couldn’t be read.");
    const image = Uint8Array.from(atob(encoded[1]), char => char.charCodeAt(0));
    return { id, name, group, photo: new Blob([image], { type: "image/jpeg" }), learned: false };
  });
}

export function addMissingCards(current, unlocked) {
  const normalize = name => name.trim().normalize("NFC").toLocaleLowerCase();
  const ids = new Set(current.map(card => card.id));
  const names = new Set(current.map(card => normalize(card.name)));
  return [...current, ...unlocked.filter(card => !ids.has(card.id) && !names.has(normalize(card.name)))];
}
