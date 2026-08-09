/**
 * Shared state for the Smash bracket page.
 *
 * Registry (one object, lists every tournament):
 *   GET    /tournaments             -> { tournaments: [...] }
 *   POST   /tournaments  {name}     -> { tournament }
 *   PATCH  /tournaments/:id {name}  -> { tournament }
 *   DELETE /tournaments/:id         -> { ok: true }
 *
 * One room per tournament, keyed by its id:
 *   GET  /t/:id/state               -> { rev, state }
 *   PUT  /t/:id/state  { rev, state }  optimistic concurrency on rev
 *                                   -> { rev, state } (200) or 409 with the winner
 *   GET  /t/:id/ws                  -> websocket; pushes { rev, state } on write
 *
 * /state and /ws without an id still resolve to the first tournament, so a
 * phone left open on an older copy of the page keeps working.
 *
 * Resetting is just a PUT of a fresh state, so there is no reset route.
 */

const ALLOWED_ORIGINS = [
  "https://jonathanlinford.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const MAX_BYTES = 512 * 1024;
const LEGACY_ID = "bro-down";          // the room that ran Benji's birthday
const LEGACY_NAME = "Benji's Birthday";

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, PUT, POST, PATCH, DELETE, OPTIONS",
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

function slugId(name) {
  const base = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${rand}` : `t-${rand}`;
}

/* ---------------------------------------------------------------
   Registry: the list of tournaments and a one-line summary of each
   --------------------------------------------------------------- */
export class Registry {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async list() {
    let list = await this.ctx.storage.get("list");
    if (!list) {
      // First run after the multi-tournament change: adopt the room that
      // already has the birthday bracket in it.
      list = [{
        id: LEGACY_ID,
        name: LEGACY_NAME,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        summary: null,
      }];
      await this.ctx.storage.put("list", list);
    }
    return list;
  }

  async save(list) {
    await this.ctx.storage.put("list", list);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const parts = url.pathname.split("/").filter(Boolean);   // ["tournaments", id?]
    const id = parts[1] ? decodeURIComponent(parts[1]) : null;

    if (request.method === "GET" && !id) {
      return json({ tournaments: await this.list() }, { status: 200 }, origin);
    }

    if (request.method === "POST" && !id) {
      const body = await request.json().catch(() => ({}));
      const name = String(body.name || "").trim().slice(0, 60) || "Untitled tournament";
      const list = await this.list();
      if (list.length >= 100) {
        return json({ error: "too many tournaments" }, { status: 409 }, origin);
      }
      const t = {
        id: slugId(name),
        name,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        summary: null,
      };
      list.push(t);
      await this.save(list);
      return json({ tournament: t }, { status: 200 }, origin);
    }

    if (request.method === "PATCH" && id) {
      const body = await request.json().catch(() => ({}));
      const list = await this.list();
      const t = list.find((x) => x.id === id);
      if (!t) return json({ error: "no such tournament" }, { status: 404 }, origin);
      if (typeof body.name === "string" && body.name.trim()) {
        t.name = body.name.trim().slice(0, 60);
      }
      if (body.summary && typeof body.summary === "object") {
        t.summary = body.summary;
        t.updatedAt = new Date().toISOString();
      }
      await this.save(list);
      return json({ tournament: t }, { status: 200 }, origin);
    }

    if (request.method === "DELETE" && id) {
      const list = await this.list();
      const next = list.filter((x) => x.id !== id);
      if (next.length === list.length) {
        return json({ error: "no such tournament" }, { status: 404 }, origin);
      }
      await this.save(next);
      return json({ ok: true }, { status: 200 }, origin);
    }

    return json({ error: "not found" }, { status: 404 }, origin);
  }
}

/* ---------------------------------------------------------------
   BracketRoom: one tournament
   --------------------------------------------------------------- */
export class BracketRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
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

  // Keep the tournament list's summary line current so the picker can show
  // who won without opening every room.
  async touchRegistry(id, state) {
    if (!id || !state) return;
    // The page works out the champion (it owns the bracket maths) and sends it
    // along, so the list can show a winner without replaying every result.
    const summary = {
      stage: state.stage || "seeding",
      format: state.format || "single",
      players: Array.isArray(state.players) ? state.players.length : 0,
      results: Object.keys(state.results || {}).length,
      champion: typeof state.championName === "string" ? state.championName : null,
    };
    try {
      const reg = this.env.REGISTRY.get(this.env.REGISTRY.idFromName("index"));
      await reg.fetch(new Request(
        `https://bracket.internal/tournaments/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary }),
        }
      ));
    } catch {
      // the summary is a nicety; never fail a write over it
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const id = url.searchParams.get("id") || "";
    const tail = url.pathname.replace(/^\/t\/[^/]+/, "") || url.pathname;

    // A socket per device instead of a poll every couple of seconds. Twelve
    // phones polling all evening is tens of thousands of requests; this is
    // twelve. Hibernation means an idle room costs nothing.
    if (tail === "/ws") {
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

    if (tail === "/state" && request.method === "GET") {
      return json(await this.read(), { status: 200 }, origin);
    }

    if (tail === "/state" && request.method === "PUT") {
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
      this.ctx.waitUntil(this.touchRegistry(id, body.state));
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

    // Forward on an internal hostname rather than passing the original request
    // through. Handing a Durable Object a request still addressed to this
    // Worker's own public hostname reads as a Worker calling itself, which
    // Cloudflare rejects (1042 on the plain routes, 1101 on the upgrade).
    const internal = (path, extra) =>
      new Request(`https://bracket.internal${path}`, extra || request);

    if (url.pathname === "/tournaments" || url.pathname.startsWith("/tournaments/")) {
      const reg = env.REGISTRY.get(env.REGISTRY.idFromName("index"));
      return reg.fetch(internal(url.pathname + url.search));
    }

    // /t/:id/state, /t/:id/ws
    const m = url.pathname.match(/^\/t\/([^/]+)(\/.*)?$/);
    const id = m ? decodeURIComponent(m[1]) : LEGACY_ID;
    const tail = m ? (m[2] || "/state") : url.pathname;

    const room = env.BRACKET.get(env.BRACKET.idFromName(id));
    return room.fetch(internal(`${tail}?id=${encodeURIComponent(id)}`));
  },
};
