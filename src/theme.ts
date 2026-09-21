export type AppTheme = 'midnight' | 'light' | 'noir' | 'ocean';

export const THEME_STORAGE_KEY = 'sql_viewer_theme';

export function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'midnight';
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === 'light' || storedTheme === 'noir' || storedTheme === 'ocean'
    ? storedTheme
    : 'midnight';
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
