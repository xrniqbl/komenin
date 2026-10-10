import { describe, expect, it } from "vitest";
import {
  formatLabel,
  missingRequiredKeys,
  parseAnyCookieFormat,
} from "@/lib/connectors/session-parse";

const HEADER = "sessionid=abc123; ds_user_id=991; csrftoken=csrf-1; mid=mid-1";

describe("parseAnyCookieFormat", () => {
  it("parses a plain cookie header", () => {
    const result = parseAnyCookieFormat(HEADER);
    expect(result.format).toBe("header");
    expect(result.cookies.sessionid).toBe("abc123");
    expect(result.cookies.ds_user_id).toBe("991");
    expect(result.cookies.csrftoken).toBe("csrf-1");
  });

  it("parses a cURL command and extracts the cookie header", () => {
    const curl = `curl 'https://www.instagram.com/api/v1/feed/' \\
      -H 'user-agent: Instagram 155' \\
      -H 'cookie: sessionid=abc123; ds_user_id=991; csrftoken=csrf-1'`;
    const result = parseAnyCookieFormat(curl);
    expect(result.format).toBe("curl");
    expect(result.cookies.sessionid).toBe("abc123");
    expect(result.cookies.csrftoken).toBe("csrf-1");
    // Non-cookie headers must not leak into the map.
    expect(result.cookies["user-agent"]).toBeUndefined();
  });

  it("parses cURL with double-quoted headers", () => {
    const curl = `curl "https://www.instagram.com/" -H "cookie: sessionid=xyz; mid=m1"`;
    const result = parseAnyCookieFormat(curl);
    expect(result.format).toBe("curl");
    expect(result.cookies.sessionid).toBe("xyz");
  });

  it("parses cURL -b shorthand", () => {
    const result = parseAnyCookieFormat(`curl 'https://x.test/' -b 'sessionid=abc; mid=m'`);
    expect(result.cookies.sessionid).toBe("abc");
  });

  it("parses a JSON array of {name,value} cookies", () => {
    const json = JSON.stringify([
      { name: "sessionid", value: "abc123" },
      { name: "ds_user_id", value: "991" },
      { name: "csrftoken", value: "csrf-1" },
    ]);
    const result = parseAnyCookieFormat(json);
    expect(result.format).toBe("json_array");
    expect(result.cookies).toEqual({
      sessionid: "abc123",
      ds_user_id: "991",
      csrftoken: "csrf-1",
    });
  });

  it("parses a wrapped {cookies:[…]} JSON object", () => {
    const json = JSON.stringify({ cookies: [{ name: "sessionid", value: "abc" }] });
    const result = parseAnyCookieFormat(json);
    expect(result.format).toBe("json_array");
    expect(result.cookies.sessionid).toBe("abc");
  });

  it("parses a flat JSON object of name→value pairs", () => {
    const json = JSON.stringify({ sessionid: "abc", ds_user_id: "991", csrftoken: "c" });
    const result = parseAnyCookieFormat(json);
    expect(result.format).toBe("json_object");
    expect(result.cookies.sessionid).toBe("abc");
  });

  it("parses a {cookie: \"…\"} wrapper", () => {
    const json = JSON.stringify({ cookie: "sessionid=abc; mid=m1" });
    const result = parseAnyCookieFormat(json);
    expect(result.format).toBe("json_object");
    expect(result.cookies.sessionid).toBe("abc");
  });

  it("parses newline / tab separated pairs", () => {
    const text = "sessionid\tabc123\nds_user_id\t991\ncsrftoken\tcsrf-1";
    const result = parseAnyCookieFormat(text);
    expect(result.format).toBe("pairs");
    expect(result.cookies.ds_user_id).toBe("991");
  });

  it("parses `name = value` lines with spaces", () => {
    const text = "sessionid = abc\n ds_user_id = 991\n csrftoken = c1";
    const result = parseAnyCookieFormat(text);
    expect(result.cookies.sessionid).toBe("abc");
    expect(result.cookies.csrftoken).toBe("c1");
  });

  it("canonicalizes known key casing regardless of input case", () => {
    const result = parseAnyCookieFormat("SessionID=abc; DS_USER_ID=991; Csrftoken=c");
    expect(result.cookies.sessionid).toBe("abc");
    expect(result.cookies.ds_user_id).toBe("991");
    expect(result.cookies.csrftoken).toBe("c");
  });

  it("strips surrounding quotes from values", () => {
    const result = parseAnyCookieFormat('sessionid="abc123"; csrftoken=\'c-1\'');
    expect(result.cookies.sessionid).toBe("abc123");
    expect(result.cookies.csrftoken).toBe("c-1");
  });

  it("ignores a nested `cookie=` key", () => {
    const result = parseAnyCookieFormat("cookie=sessionid=abc; sessionid=real");
    expect(result.cookies.cookie).toBeUndefined();
    expect(result.cookies.sessionid).toBe("real");
  });

  it("skips malformed segments without throwing", () => {
    const result = parseAnyCookieFormat("noequals; sessionid=abc; =orphan; csrftoken=c");
    expect(result.cookies.sessionid).toBe("abc");
    expect(result.cookies.csrftoken).toBe("c");
  });

  it("returns an empty result for blank input", () => {
    expect(parseAnyCookieFormat("")).toEqual({
      cookies: {},
      format: "empty",
      keys: [],
    });
    expect(parseAnyCookieFormat("   ").format).toBe("empty");
  });

  it("returns empty for garbage with no '=' pairs", () => {
    expect(parseAnyCookieFormat("hello world this is not a cookie").format).toBe("empty");
  });

  it("does not put cookie values into the keys list", () => {
    const result = parseAnyCookieFormat(HEADER);
    expect(result.keys).toEqual(["csrftoken", "ds_user_id", "mid", "sessionid"]);
    for (const key of result.keys) {
      expect(key).not.toContain("abc123");
    }
  });

  it("survives a cURL command whose cookie header uses double quotes inside", () => {
    const curl = `curl 'https://x.test/' -H "cookie: sessionid=abc%3D1; mid=m"`;
    const result = parseAnyCookieFormat(curl);
    expect(result.cookies.sessionid).toBe("abc%3D1");
  });
});

describe("missingRequiredKeys", () => {
  it("reports only the absent keys", () => {
    const cookies = parseAnyCookieFormat("sessionid=abc").cookies;
    expect(missingRequiredKeys(cookies, ["sessionid", "ds_user_id", "csrftoken"])).toEqual([
      "ds_user_id",
      "csrftoken",
    ]);
  });

  it("is case-insensitive about presence", () => {
    const cookies = parseAnyCookieFormat("SessionID=abc; DS_USER_ID=1; CSRFTOKEN=c").cookies;
    expect(missingRequiredKeys(cookies, ["sessionid", "ds_user_id", "csrftoken"])).toEqual([]);
  });

  it("returns nothing when every key is present", () => {
    const cookies = parseAnyCookieFormat(HEADER).cookies;
    expect(missingRequiredKeys(cookies, ["sessionid", "csrftoken"])).toEqual([]);
  });
});

describe("formatLabel", () => {
  it("returns an Indonesian label for every recognized format", () => {
    for (const format of ["curl", "json_array", "json_object", "header", "pairs", "empty"] as const) {
      expect(formatLabel(format)).toBeTruthy();
    }
  });

  it("labels unknown formats defensively", () => {
    expect(formatLabel("nope" as never)).toBe("Belum dikenali");
  });
});
