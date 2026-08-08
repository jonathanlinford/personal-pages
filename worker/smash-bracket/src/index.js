/**
 * Shared state for the Smash bracket page.
 *
 *   GET  /state          -> { rev, state }
 *   PUT  /state          <- { rev, state }   optimistic concurrency on rev
 *                        -> { rev, state } (200) or 409 with the current copy
 *   POST /reset          -> wipes back to an empty tournament
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

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

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
      return json(next, { status: 200 }, origin);
    }

    if (url.pathname === "/reset" && request.method === "POST") {
      const current = await this.read();
      const next = { rev: current.rev + 1, state: null, updatedAt: new Date().toISOString() };
      await this.ctx.storage.put("record", next);
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
