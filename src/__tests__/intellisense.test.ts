import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getCompletionsForPosition } from '../editor/intellisense';
import { SqlEditor } from '../editor/SqlEditor';
import { Schema } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    return React.createElement('div', {
      'data-testid': 'mock-monaco-editor',
      'data-value': props.value,
      'data-language': props.defaultLanguage,
    });
  },
}));

describe('IntelliSense Autocomplete Provider', () => {
  const mockSchema: Schema = {
    name: 'main',
    tables: [
      {
        name: 'movies',
        schema: 'main',
        rowCount: 10,
        columns: [
          { name: 'movie_id', type: 'INTEGER', isPrimaryKey: true },
          { name: 'title', type: 'VARCHAR' },
          { name: 'release_year', type: 'INTEGER' },
        ],
      },
      {
        name: 'reviews',
        schema: 'main',
        rowCount: 25,
        columns: [
          { name: 'review_id', type: 'INTEGER', isPrimaryKey: true },
          { name: 'movie_id', type: 'INTEGER', isForeignKey: true },
          { name: 'score', type: 'FLOAT' },
          { name: 'comment', type: 'VARCHAR' },
        ],
      },
    ],
  };

  describe('SQL Keywords', () => {
    it('should return all standard SQL keywords when word is empty', () => {
      const completions = getCompletionsForPosition('SELECT * FROM movies', '', null);
      const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'DISTINCT', 'AS', 'AND', 'OR'];

      keywords.forEach((kw) => {
        const match = completions.find((c) => c.label === kw);
        expect(match).toBeDefined();
        expect(match?.kind).toBe(14);
        expect(match?.insertText).toBe(kw);
        expect(match?.detail).toBe('SQL Keyword');
      });
    });

    it('should filter keywords matching word prefix case-insensitively', () => {
      const selCompletions = getCompletionsForPosition('', 'sel', null);
      expect(selCompletions.map((c) => c.label)).toContain('SELECT');
      expect(selCompletions.map((c) => c.label)).not.toContain('FROM');

      const grCompletions = getCompletionsForPosition('', 'GROUP', null);
      expect(grCompletions.map((c) => c.label)).toContain('GROUP BY');

      const noMatch = getCompletionsForPosition('', 'nonexistent', null);
      const keywordMatches = noMatch.filter((c) => c.detail === 'SQL Keyword');
      expect(keywordMatches).toHaveLength(0);
    });
  });

  describe('Aggregate Functions', () => {
    it('should return all aggregate functions when word is empty', () => {
      const completions = getCompletionsForPosition('', '', null);
      const funcs = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE'];

      funcs.forEach((fn) => {
        const match = completions.find((c) => c.label === `${fn}(expression)`);
        expect(match).toBeDefined();
        expect(match?.kind).toBe(3);
        expect(match?.insertText).toBe(`${fn}($1)`);
        expect(match?.detail).toBe('Aggregate Function');
      });
    });

    it('should filter aggregates by prefix case-insensitively', () => {
      const coCompletions = getCompletionsForPosition('', 'co', null);
      const labels = coCompletions.map((c) => c.label);
      expect(labels).toContain('COUNT(expression)');
      expect(labels).toContain('COALESCE(expression)');
      expect(labels).not.toContain('AVG(expression)');

      const avgCompletions = getCompletionsForPosition('', 'avg', null);
      expect(avgCompletions.map((c) => c.label)).toContain('AVG(expression)');
      expect(avgCompletions.map((c) => c.label)).not.toContain('SUM(expression)');
    });
  });

  describe('Schema and Table Completions', () => {
    it('should return no table completions if schema is null', () => {
      const completions = getCompletionsForPosition('SELECT * FROM movies', '', null);
      const tableCompletions = completions.filter((c) => c.kind === 5);
      const columnCompletions = completions.filter((c) => c.kind === 9);

      expect(tableCompletions).toHaveLength(0);
      expect(columnCompletions).toHaveLength(0);
    });

    it('should suggest table names with column counts when schema is provided', () => {
      const completions = getCompletionsForPosition('', '', mockSchema);

      const moviesTbl = completions.find((c) => c.label === 'movies');
      expect(moviesTbl).toBeDefined();
      expect(moviesTbl?.kind).toBe(5);
      expect(moviesTbl?.insertText).toBe('movies');
      expect(moviesTbl?.detail).toBe('Table (3 columns)');

      const reviewsTbl = completions.find((c) => c.label === 'reviews');
      expect(reviewsTbl).toBeDefined();
      expect(reviewsTbl?.kind).toBe(5);
      expect(reviewsTbl?.insertText).toBe('reviews');
      expect(reviewsTbl?.detail).toBe('Table (4 columns)');
    });
  });

  describe('Table Aliases and Column Completions', () => {
    it('should suggest aliased column names based on query AST', () => {
      const sql = 'SELECT m.title FROM movies m JOIN reviews r ON r.movie_id = m.movie_id WHERE r.score >= 7';
      const completions = getCompletionsForPosition(sql, '', mockSchema);

      // Columns for alias 'm' (movies)
      const mTitle = completions.find((c) => c.label === 'm.title');
      expect(mTitle).toBeDefined();
      expect(mTitle?.kind).toBe(9);
      expect(mTitle?.insertText).toBe('m.title');
      expect(mTitle?.detail).toBe('movies.title VARCHAR');

      const mId = completions.find((c) => c.label === 'm.movie_id');
      expect(mId).toBeDefined();
      expect(mId?.kind).toBe(9);
      expect(mId?.detail).toBe('movies.movie_id INTEGER');

      // Columns for alias 'r' (reviews)
      const rScore = completions.find((c) => c.label === 'r.score');
      expect(rScore).toBeDefined();
      expect(rScore?.kind).toBe(9);
      expect(rScore?.insertText).toBe('r.score');
      expect(rScore?.detail).toBe('reviews.score FLOAT');
    });

    it('should handle unaliased table references', () => {
      const sql = 'SELECT title FROM movies WHERE movie_id = 1';
      const completions = getCompletionsForPosition(sql, '', mockSchema);

      const moviesTitle = completions.find((c) => c.label === 'movies.title');
      expect(moviesTitle).toBeDefined();
      expect(moviesTitle?.kind).toBe(9);
      expect(moviesTitle?.detail).toBe('movies.title VARCHAR');
    });

    it('should gracefully handle unknown table aliases without crashing', () => {
      const sql = 'SELECT u.name FROM unknown_table u';
      expect(() => getCompletionsForPosition(sql, '', mockSchema)).not.toThrow();

      const completions = getCompletionsForPosition(sql, '', mockSchema);
      const uCol = completions.find((c) => c.label.startsWith('u.'));
      expect(uCol).toBeUndefined();
    });
  });

  describe('SqlEditor Component', () => {
    it('should render SQL editor header and mock editor container', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const root = createRoot(container);
      act(() => {
        root.render(React.createElement(SqlEditor));
      });

      expect(container.textContent).toContain('SQL EDITOR');
      expect(container.textContent).toContain('Press F5 or click Run to execute');

      const editorEl = container.querySelector('[data-testid="mock-monaco-editor"]');
      expect(editorEl).not.toBeNull();
      expect(editorEl?.getAttribute('data-language')).toBe('sql');
    });
  });
});
