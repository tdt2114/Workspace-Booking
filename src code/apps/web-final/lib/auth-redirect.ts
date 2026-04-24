export function getSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export function buildLoginRedirectUrl(currentPath?: string) {
  const redirectTo =
    currentPath ??
    (typeof window === "undefined"
      ? "/dashboard"
      : `${window.location.pathname}${window.location.search}`);

  return `/login?redirectTo=${encodeURIComponent(getSafeRedirectTo(redirectTo))}`;
}
