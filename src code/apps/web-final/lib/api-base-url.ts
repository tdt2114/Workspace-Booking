const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getBrowserApiBaseUrl() {
  const envValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallbackUrl = "http://localhost:3001";
  const browserFallbackUrl = "/api";

  if (typeof window === "undefined") {
    return envValue ? trimTrailingSlash(envValue) : fallbackUrl;
  }

  if (!envValue) {
    return browserFallbackUrl;
  }

  if (envValue.startsWith("/")) {
    return trimTrailingSlash(envValue);
  }

  try {
    const parsedUrl = new URL(envValue);

    if (LOCAL_API_HOSTS.has(parsedUrl.hostname)) {
      return browserFallbackUrl;
    }

    return trimTrailingSlash(parsedUrl.toString());
  } catch {
    return browserFallbackUrl;
  }
}
