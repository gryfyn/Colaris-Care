export const DEFAULT_THEME = "spruce";
export const THEME_COOKIE = "colaris.theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEME_IDS = [
  "spruce", "ocean", "indigo", "plum", "rose", "copper", "forest", "sand",
  "mint", "lavender", "slate", "graphite", "midnight", "obsidian", "nocturne", "mulberry",
];

const THEME_ID_SET = new Set(THEME_IDS);

export function normalizeTheme(theme) {
  return THEME_ID_SET.has(theme) ? theme : null;
}

export function isThemeId(theme) {
  return Boolean(normalizeTheme(theme));
}

export function serializeThemeCookie(theme, maxAge = THEME_COOKIE_MAX_AGE) {
  const normalized = normalizeTheme(theme);
  if (!normalized) return null;
  return [
    `${THEME_COOKIE}=${encodeURIComponent(normalized)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : null,
  ].filter(Boolean).join("; ");
}

export function setClientThemePreference(theme) {
  const normalized = normalizeTheme(theme);
  if (!normalized || typeof document === "undefined") return null;
  document.documentElement.setAttribute("data-cx-theme", normalized);
  document.cookie = serializeThemeCookie(normalized);
  return normalized;
}
