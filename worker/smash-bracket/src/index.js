/**
 * Shared state for the Smash bracket page.
 *
 *   GET  /state          -> { rev, state }
 *   PUT  /state          <- { rev, state }   optimistic concurrency on rev
 *                        -> { rev, state } (200) or 409 with the current copy
 *
 * Resetting is just a PUT of a fresh state, so there is no reset route.
 *
 * The page owns all bracket logic; this only stores the blob and serializes
 * writes so two people reporting a result at once cannot clobber each other.
 */

const ALLOWED_ORIGINS = [
  "https://jonathanlinford.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const MAX_BYTES = 512 * 1024;

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, init, origin) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...cors(origin),
      ...(init && init.headers ? init.headers : {}),
    },
  });
}

export class BracketRoom {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async read() {
    const rec = await this.ctx.storage.get("record");
    return rec || { rev: 0, state: null, updatedAt: null };
  }

  // Push the new record to everybody who is holding a socket open.
  broadcast(record) {
    const msg = JSON.stringify(record);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        // socket is gone; the runtime will clean it up
      }
    }
  }

  async webSocketMessage(ws) {
    // Clients only listen. A stray message just gets the current record back.
    ws.send(JSON.stringify(await this.read()));
  }

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // A socket per device instead of a poll every couple of seconds. Twelve
    // phones polling all evening is tens of thousands of requests; this is
    // twelve. Hibernation means an idle room costs nothing.
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return json({ error: "expected websocket" }, { status: 426 }, origin);
      }
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      const record = await this.read();
      try {
        pair[1].send(JSON.stringify(record));
      } catch {
        // client vanished mid-handshake
      }
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === "/state" && request.method === "GET") {
      return json(await this.read(), { status: 200 }, origin);
    }

    if (url.pathname === "/state" && request.method === "PUT") {
      const raw = await request.text();
      if (raw.length > MAX_BYTES) {
        return json({ error: "state too large" }, { status: 413 }, origin);
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: "invalid JSON" }, { status: 400 }, origin);
      }
      if (typeof body.rev !== "number" || typeof body.state !== "object" || body.state === null) {
        return json({ error: "expected { rev, state }" }, { status: 400 }, origin);
      }

      const current = await this.read();
      if (body.rev !== current.rev) {
        // Somebody else wrote first. Hand back the winning copy so the caller
        // can replay its change on top of it.
        return json({ error: "conflict", ...current }, { status: 409 }, origin);
      }

      const next = {
        rev: current.rev + 1,
        state: body.state,
        updatedAt: new Date().toISOString(),
      };
      await this.ctx.storage.put("record", next);
      this.broadcast(next);
      return json(next, { status: 200 }, origin);
    }

    return json({ error: "not found" }, { status: 404 }, origin);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/") {
      return json({ ok: true, service: "smash-bracket" }, { status: 200 }, origin);
    }

    // One room, one tournament.
    const id = env.BRACKET.idFromName("bro-down");
    return env.BRACKET.get(id).fetch(request);
  },
};
