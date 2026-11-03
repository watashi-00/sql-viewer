import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, getInitialTheme } from '../theme';

const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

afterEach(() => {
  if (localStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', localStorageDescriptor);
  } else {
    delete (window as unknown as { localStorage?: Storage }).localStorage;
  }
});

describe('theme storage fallback', () => {
  it('uses the default theme when localStorage is unavailable', () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined });

    expect(getInitialTheme()).toBe('midnight');
    expect(() => applyTheme('ocean')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('ocean');
  });

  it('keeps the app usable when localStorage access throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new Error('storage disabled'); },
    });

    expect(getInitialTheme()).toBe('midnight');
    expect(() => applyTheme('light')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
