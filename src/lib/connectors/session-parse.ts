/**
 * Multi-format session cookie parser.
 *
 * Beginner users paste whatever they manage to copy from DevTools, an
 * extension, a terminal, or a group chat. Rather than teaching them one
 * canonical format, we accept every shape that realistically reaches the
 * clipboard and normalize it into a `name -> value` map.
 *
 * Recognized shapes (tried in this order):
 *  1. cURL command          curl 'https://…' -H 'cookie: a=b; c=d'
 *  2. JSON                  {"cookies":[{"name":"sessionid","value":"…"}]}
 *                           {"sessionid":"…","ds_user_id":"…"}
 *  3. Cookie header         sessionid=…; ds_user_id=…; csrftoken=…
 *  4. Line / tab separated  sessionid\t…\nds_user_id\t…
 *  5. Key = value pairs     sessionid = …\nds_user_id = …
 *
 * Values are never logged or returned in error messages — only the key names
 * the user is missing, so a paste can be debugged without leaking a session.
 */

export type ParsedCookies = Record<string, string>;

export type ParseCookieResult = {
  cookies: ParsedCookies;
  /** How the input was understood — surfaced in the UI as a friendly hint. */
  format: "curl" | "json_array" | "json_object" | "header" | "pairs" | "empty";
  /** Cookie names found, sorted — used to tell the user what arrived. */
  keys: string[];
};

const COOKIE_KEYS_OF_INTEREST = [
  "sessionid",
  "ds_user_id",
  "csrftoken",
  "mid",
  "ig_did",
  "sid_tt",
  "sid_guard",
  "rur",
  "msToken",
  "tt_csrf_token",
] as const;

function clean(name: string): string {
  return name.trim().replace(/^"|"$/g, "");
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function normalizeName(name: string): string {
  // Cookie names are case-sensitive in the wire format, but users retyping
  // them routinely mangle the case. Known keys are canonicalized; unknown
  // keys keep whatever case was pasted.
  const trimmed = clean(name);
  const match = COOKIE_KEYS_OF_INTEREST.find(
    (known) => known.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

function setCookie(map: ParsedCookies, rawName: string, rawValue: string): void {
  const name = normalizeName(rawName);
  const value = unquote(rawValue);
  if (!name || !value) return;
  if (name.toLowerCase() === "cookie") return; // nested header, skip
  map[name] = value;
}

/**
 * Pull the cookie value out of a cURL command. Handles both single-quoted
 * (`-H 'cookie: a=b'`) and double-quoted (`-H "cookie: a=b"`) forms, plus the
 * `--cookie` / `-b` shorthand.
 */
function extractFromCurl(input: string): string | null {
  const patterns = [
    /(?:-H|--header)\s+["']?cookie:\s*([^"']+)["']?/i,
    /(?:-b|--cookie)\s+["']([^"']+)["']/,
    /(?:-b|--cookie)\s+([^\s"']+)/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function parseHeaderLike(text: string): ParsedCookies {
  const map: ParsedCookies = {};
  // Accept both the HTTP `; ` separator and newlines that some tools emit.
  const segments = text.split(/[;\n]/);
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    setCookie(map, trimmed.slice(0, idx), trimmed.slice(idx + 1));
  }
  return map;
}

function parsePairs(text: string): ParsedCookies {
  const map: ParsedCookies = {};
  for (const line of text.split(/[\n\r]+/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*[=:]\s*(.+)$/);
    if (match?.[1] && match[2] !== undefined) {
      setCookie(map, match[1], match[2]);
      continue;
    }
    // Tab- or space-separated `name<TAB>value` (no '=' / ':' at all) — the
    // shape produced by "copy as table" and by several cookie-export tools.
    const fields = trimmed.split(/\t+/).map((f) => f.trim());
    if (fields.length >= 2 && fields[0] && fields[1]) {
      setCookie(map, fields[0], fields[1]);
    }
  }
  return map;
}

function fromJsonArray(value: unknown[]): ParsedCookies {
  const map: ParsedCookies = {};
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.name === "string" && typeof entry.value === "string") {
      setCookie(map, entry.name, entry.value);
    } else if (typeof entry.key === "string" && typeof entry.val === "string") {
      setCookie(map, entry.key, entry.val);
    }
  }
  return map;
}

function fromJsonObject(value: Record<string, unknown>): ParsedCookies {
  const map: ParsedCookies = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string") setCookie(map, key, val);
    else if (typeof val === "number") setCookie(map, key, String(val));
  }
  return map;
}

export function parseAnyCookieFormat(raw: string): ParseCookieResult {
  const text = (raw || "").trim();
  if (!text) return { cookies: {}, format: "empty", keys: [] };

  const finish = (
    cookies: ParsedCookies,
    format: ParseCookieResult["format"],
  ): ParseCookieResult => ({
    cookies,
    format,
    keys: Object.keys(cookies).sort(),
  });

  // 1. cURL
  if (/\bcurl\b/i.test(text)) {
    const header = extractFromCurl(text);
    const cookies = header ? parseHeaderLike(header) : {};
    if (Object.keys(cookies).length > 0) return finish(cookies, "curl");
  }

  // 2. JSON
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const cookies = fromJsonArray(parsed);
        if (Object.keys(cookies).length > 0) return finish(cookies, "json_array");
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        // Wrapper shapes: {cookies:[…]} or {cookie:"a=b; c=d"}
        if (Array.isArray(obj.cookies)) {
          const cookies = fromJsonArray(obj.cookies);
          if (Object.keys(cookies).length > 0) return finish(cookies, "json_array");
        }
        if (typeof obj.cookie === "string") {
          const cookies = parseHeaderLike(obj.cookie);
          if (Object.keys(cookies).length > 0) return finish(cookies, "json_object");
        }
        if (typeof obj.cookieHeader === "string") {
          const cookies = parseHeaderLike(obj.cookieHeader);
          if (Object.keys(cookies).length > 0) return finish(cookies, "json_object");
        }
        const cookies = fromJsonObject(obj);
        if (Object.keys(cookies).length > 0) return finish(cookies, "json_object");
      }
    } catch {
      // fall through — malformed JSON still often contains usable pairs
    }
  }

  // 3. Header (`a=b; c=d`) — the most common paste.
  if (text.includes("=") && (text.includes(";") || /\n/.test(text) === false)) {
    const cookies = parseHeaderLike(text);
    if (Object.keys(cookies).length > 0) return finish(cookies, "header");
  }

  // 4/5. Line or tab separated pairs
  const pairs = parsePairs(text);
  if (Object.keys(pairs).length > 0) return finish(pairs, "pairs");

  // Last chance: header parse across newlines.
  const header = parseHeaderLike(text);
  if (Object.keys(header).length > 0) return finish(header, "header");

  return { cookies: {}, format: "empty", keys: [] };
}

/**
 * Human-readable feedback about a parse, e.g. which required platform cookies
 * are still missing. Returns cookie NAMES only — never values.
 */
export function missingRequiredKeys(
  cookies: ParsedCookies,
  required: string[],
): string[] {
  const present = new Set(Object.keys(cookies).map((k) => k.toLowerCase()));
  return required.filter((key) => !present.has(key.toLowerCase()));
}

export function formatLabel(format: ParseCookieResult["format"]): string {
  switch (format) {
    case "curl":
      return "Perintah cURL";
    case "json_array":
      return "JSON (daftar cookie)";
    case "json_object":
      return "JSON (objek)";
    case "header":
      return "Header cookie";
    case "pairs":
      return "Daftar nama=nilai";
    default:
      return "Belum dikenali";
  }
}
