type BrowserLocation = Pick<Location, "protocol" | "hostname" | "origin">;

export function resolveApiBase(
  configured: string | undefined,
  location: BrowserLocation,
  development: boolean
): string {
  const fallback = development ? `${location.protocol}//${location.hostname}:8001/api` : "/api";
  const value = configured?.trim();
  if (!value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//")) return value.replace(/\/$/, "");

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return fallback;
    const configuredLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const currentLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    if (configuredLocal && !currentLocal) {
      if (!development || location.protocol === "https:") return "/api";
      url.protocol = location.protocol;
      url.hostname = location.hostname;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}
