import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DistinctVisualizer } from '../visualizer/DistinctVisualizer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('DistinctVisualizer Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const render = (ui: React.ReactElement) => {
    act(() => {
      root.render(ui);
    });
  };

  const screen = {
    getByText: (matcher: string | RegExp) => {
      const all = Array.from(container.querySelectorAll('*'));
      for (const el of all) {
        const text = el.textContent || '';
        const matches = typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text);
        if (matches) {
          const childMatches = Array.from(el.children).some((child) => {
            const childText = child.textContent || '';
            return typeof matcher === 'string' ? childText.includes(matcher) : matcher.test(childText);
          });
          if (!childMatches) {
            return el;
          }
        }
      }
      for (const el of all) {
        const text = el.textContent || '';
        if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) {
          return el;
        }
      }
      throw new Error(`Unable to find element with text matching ${matcher}`);
    },
    queryByText: (matcher: string | RegExp) => {
      try {
        return screen.getByText(matcher);
      } catch {
        return null;
      }
    },
  };

  it('renders deduplication metrics with explicit duplicatesRemoved', () => {
    render(<DistinctVisualizer inputCount={5} outputCount={3} duplicatesRemoved={2} />);
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText(/2 Duplicates Collapsed/i)).toBeDefined();
  });

  it('renders DISTINCT DEDUPLICATION header and column labels', () => {
    render(<DistinctVisualizer inputCount={10} outputCount={7} duplicatesRemoved={3} />);
    expect(screen.getByText(/DISTINCT DEDUPLICATION/i)).toBeDefined();
    expect(screen.getByText(/INPUT ROWS/i)).toBeDefined();
    expect(screen.getByText(/OUTPUT UNIQUE ROWS/i)).toBeDefined();
    expect(screen.getByText(/DUPLICATES REMOVED/i)).toBeDefined();
  });

  it('automatically calculates duplicatesRemoved when omitted from inputCount and outputCount', () => {
    render(<DistinctVisualizer inputCount={12} outputCount={8} />);
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('8')).toBeDefined();
    expect(screen.getByText(/4 Duplicates Collapsed/i)).toBeDefined();
  });

  it('supports distinctDuplicatesRemoved alias prop', () => {
    render(<DistinctVisualizer inputCount={15} outputCount={10} distinctDuplicatesRemoved={5} />);
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText(/5 Duplicates Collapsed/i)).toBeDefined();
  });

  it('derives counts from inputRows and outputRows arrays if provided', () => {
    const inputRows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Alice' },
      { id: 3, name: 'Charlie' },
    ];
    const outputRows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];
    render(<DistinctVisualizer inputRows={inputRows} outputRows={outputRows} />);
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText(/1 Duplicates Collapsed/i)).toBeDefined();
  });

  it('handles case where no duplicates are removed', () => {
    render(<DistinctVisualizer inputCount={6} outputCount={6} duplicatesRemoved={0} />);
    expect(screen.getByText('6')).toBeDefined();
    expect(screen.getByText(/0 Duplicates Collapsed/i)).toBeDefined();
  });

  it('renders gracefully with default zeros when props are empty', () => {
    render(<DistinctVisualizer />);
    expect(screen.getByText(/DISTINCT DEDUPLICATION/i)).toBeDefined();
    expect(screen.getByText(/0 Duplicates Collapsed/i)).toBeDefined();
  });
});
