export type AppTheme = 'midnight' | 'light' | 'noir' | 'ocean';

export const THEME_STORAGE_KEY = 'sql_viewer_theme';

function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getInitialTheme(): AppTheme {
  const storage = getLocalStorage();
  if (!storage) return 'midnight';
  let storedTheme: string | null = null;
  try {
    storedTheme = storage.getItem(THEME_STORAGE_KEY);
  } catch {
    return 'midnight';
  }
  return storedTheme === 'light' || storedTheme === 'noir' || storedTheme === 'ocean'
    ? storedTheme
    : 'midnight';
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    getLocalStorage()?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme still applies for the current session when browser storage is unavailable.
  }
}
