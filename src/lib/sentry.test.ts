import { describe, expect, it } from "vitest";
import { buildEnvelope, buildEvent, parseDsn } from "./sentry";

describe("parseDsn", () => {
  it("parses a standard Sentry cloud DSN", () => {
    const p = parseDsn("https://abc123@o12345.ingest.sentry.io/6789");
    expect(p).not.toBeNull();
    expect(p!.host).toBe("o12345.ingest.sentry.io");
    expect(p!.publicKey).toBe("abc123");
    expect(p!.projectId).toBe("6789");
    expect(p!.ingestUrl).toBe(
      "https://o12345.ingest.sentry.io/api/6789/envelope/?sentry_key=abc123&sentry_version=7",
    );
  });

  it("tolerates a legacy secret in the userinfo", () => {
    const p = parseDsn("https://pub:secret@sentry.example.com/42");
    expect(p!.publicKey).toBe("pub");
    expect(p!.projectId).toBe("42");
  });

  it("returns null for unset / malformed / non-http DSNs", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("ftp://k@host/1")).toBeNull();
    expect(parseDsn("https://host/1")).toBeNull(); // no public key
    expect(parseDsn("https://k@host/")).toBeNull(); // no project id
  });
});

describe("buildEvent", () => {
  it("maps an Error to an exception value + stack extra + tags", () => {
    const err = new TypeError("boom");
    const ev = buildEvent({
      eventId: "deadbeef",
      timestamp: 1000,
      environment: "production",
      error: err,
      context: { route: "api/health" },
    });
    expect(ev.event_id).toBe("deadbeef");
    expect(ev.timestamp).toBe(1000);
    expect(ev.level).toBe("error");
    expect(ev.environment).toBe("production");
    expect(ev.exception.values[0]).toEqual({
      type: "TypeError",
      value: "boom",
    });
    expect(ev.tags).toEqual({ route: "api/health" });
    expect(ev.extra?.stack).toContain("boom");
  });

  it("handles a non-Error thrown value", () => {
    const ev = buildEvent({
      eventId: "x",
      timestamp: 1,
      environment: "development",
      error: "just a string",
    });
    expect(ev.exception.values[0]!.type).toBe("UnknownError");
    expect(ev.exception.values[0]!.value).toBe("just a string");
    expect(ev.tags).toBeUndefined();
  });
});

describe("buildEnvelope", () => {
  it("produces the 3-line newline-delimited envelope", () => {
    const ev = buildEvent({
      eventId: "abcd",
      timestamp: 5,
      environment: "test",
      error: new Error("x"),
    });
    const env = buildEnvelope(ev, "2026-07-22T00:00:00.000Z");
    const lines = env.trimEnd().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!)).toEqual({
      event_id: "abcd",
      sent_at: "2026-07-22T00:00:00.000Z",
    });
    expect(JSON.parse(lines[1]!)).toEqual({ type: "event" });
    expect(JSON.parse(lines[2]!).event_id).toBe("abcd");
    expect(env.endsWith("\n")).toBe(true);
  });
});
