export type ThemeMode = 'system' | 'light' | 'dark'
export type ThemeName = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'painel_theme_mode'

export function normalizeThemeMode(value: unknown): ThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ThemeName {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

export function getThemeInitScript() {
  return `
    (function () {
      try {
        var key = '${THEME_STORAGE_KEY}';
        var raw = localStorage.getItem(key);
        var mode = raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.style.colorScheme = resolved;
      } catch (_) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
      }
    })();
  `
}
