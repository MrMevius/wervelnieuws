import { describe, expect, it } from "vitest";
import { resolveApiBase } from "./baseUrl";

const production = { protocol: "https:", hostname: "app.example.org", origin: "https://app.example.org" };
const local = { protocol: "http:", hostname: "localhost", origin: "http://localhost:5173" };

describe("API base URL", () => {
  it("uses the reverse proxy in production without a configured URL", () => {
    expect(resolveApiBase(undefined, production, false)).toBe("/api");
    expect(resolveApiBase(" ", local, false)).toBe("/api");
  });
  it("keeps the separate backend port during local development", () => {
    expect(resolveApiBase(undefined, local, true)).toBe("http://localhost:8001/api");
  });
  it("supports explicit relative and remote API URLs", () => {
    expect(resolveApiBase("/api/", production, false)).toBe("/api");
    expect(resolveApiBase("https://api.example.org/api/", production, false)).toBe("https://api.example.org/api");
  });
  it("does not send deployed users to localhost or a development port", () => {
    expect(resolveApiBase("http://localhost:8001/api", production, false)).toBe("/api");
    expect(resolveApiBase("http://localhost:8001/api", { ...production, protocol: "http:" }, false)).toBe("/api");
  });
  it("allows testing the development server from a phone on the LAN", () => {
    expect(resolveApiBase("http://localhost:8001/api", { ...local, hostname: "192.168.1.2" }, true)).toBe("http://192.168.1.2:8001/api");
  });
  it("ignores malformed or credential-bearing configuration", () => {
    for (const value of ["invalid", "javascript:alert(1)", "https://user:password@example.org/api"]) {
      expect(resolveApiBase(value, production, false)).toBe("/api");
    }
  });
});
