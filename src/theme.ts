export type AppTheme = 'midnight' | 'light';

export const THEME_STORAGE_KEY = 'sql_viewer_theme';

export function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'midnight';
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'midnight';
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
