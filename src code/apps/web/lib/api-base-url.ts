const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getBrowserApiBaseUrl() {
  const envValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (typeof window === "undefined") {
    return envValue ? trimTrailingSlash(envValue) : null;
  }

  const fallbackUrl = `${window.location.protocol}//${window.location.hostname}:3001`;

  if (!envValue) {
    return fallbackUrl;
  }

  try {
    const parsedUrl = new URL(envValue);

    if (LOCAL_API_HOSTS.has(parsedUrl.hostname)) {
      parsedUrl.hostname = window.location.hostname;

      if (!parsedUrl.port) {
        parsedUrl.port = "3001";
      }

      return trimTrailingSlash(parsedUrl.toString());
    }

    return trimTrailingSlash(parsedUrl.toString());
  } catch {
    return fallbackUrl;
  }
}
