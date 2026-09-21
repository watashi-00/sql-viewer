import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getCompletionsForPosition } from '../editor/intellisense';
import { SqlEditor, defineSqlDarkTheme } from '../editor/SqlEditor';
import { Schema } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    if (props.beforeMount) {
      props.beforeMount({
        editor: {
          defineTheme: vi.fn(),
        },
      });
    }
    return React.createElement('div', {
      'data-testid': 'mock-monaco-editor',
      'data-value': props.value,
      'data-language': props.defaultLanguage,
      'data-theme': props.theme,
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
    it('should return all aggregate functions when word is empty with snippet rule', () => {
      const completions = getCompletionsForPosition('', '', null);
      const funcs = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE'];

      funcs.forEach((fn) => {
        const match = completions.find((c) => c.label === `${fn}(expression)`);
        expect(match).toBeDefined();
        expect(match?.kind).toBe(3);
        expect(match?.insertText).toBe(`${fn}($1)`);
        expect(match?.insertTextRules).toBe(4);
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

    it('should filter table suggestions by prefix case-insensitively', () => {
      const movCompletions = getCompletionsForPosition('', 'mov', mockSchema);
      const movTables = movCompletions.filter((c) => c.kind === 5);
      expect(movTables.map((c) => c.label)).toEqual(['movies']);

      const revCompletions = getCompletionsForPosition('', 'REV', mockSchema);
      const revTables = revCompletions.filter((c) => c.kind === 5);
      expect(revTables.map((c) => c.label)).toEqual(['reviews']);

      const noMatch = getCompletionsForPosition('', 'nonexistent', mockSchema);
      const noTables = noMatch.filter((c) => c.kind === 5);
      expect(noTables).toHaveLength(0);
    });
  });

  describe('Table Aliases and Column Completions', () => {
    it('should suggest aliased column names based on query AST with insertText as column name', () => {
      const sql = 'SELECT m.title FROM movies m JOIN reviews r ON r.movie_id = m.movie_id WHERE r.score >= 7';
      const completions = getCompletionsForPosition(sql, '', mockSchema);

      // Columns for alias 'm' (movies)
      const mTitle = completions.find((c) => c.label === 'm.title');
      expect(mTitle).toBeDefined();
      expect(mTitle?.kind).toBe(9);
      expect(mTitle?.insertText).toBe('title');
      expect(mTitle?.detail).toBe('movies.title VARCHAR');

      const mId = completions.find((c) => c.label === 'm.movie_id');
      expect(mId).toBeDefined();
      expect(mId?.kind).toBe(9);
      expect(mId?.insertText).toBe('movie_id');
      expect(mId?.detail).toBe('movies.movie_id INTEGER');

      // Columns for alias 'r' (reviews)
      const rScore = completions.find((c) => c.label === 'r.score');
      expect(rScore).toBeDefined();
      expect(rScore?.kind).toBe(9);
      expect(rScore?.insertText).toBe('score');
      expect(rScore?.detail).toBe('reviews.score FLOAT');
    });

    it('should handle unaliased table references with insertText as column name', () => {
      const sql = 'SELECT title FROM movies WHERE movie_id = 1';
      const completions = getCompletionsForPosition(sql, '', mockSchema);

      const moviesTitle = completions.find((c) => c.label === 'movies.title');
      expect(moviesTitle).toBeDefined();
      expect(moviesTitle?.kind).toBe(9);
      expect(moviesTitle?.insertText).toBe('title');
      expect(moviesTitle?.detail).toBe('movies.title VARCHAR');
    });

    it('should gracefully handle unknown table aliases without crashing', () => {
      const sql = 'SELECT u.name FROM unknown_table u';
      expect(() => getCompletionsForPosition(sql, '', mockSchema)).not.toThrow();

      const completions = getCompletionsForPosition(sql, '', mockSchema);
      const uCol = completions.find((c) => c.label.startsWith('u.'));
      expect(uCol).toBeUndefined();
    });

    it('should support dot completion for alias (e.g. m. -> col.name) and filter other items', () => {
      const sql = 'SELECT m. FROM movies m JOIN reviews r ON r.movie_id = m.movie_id';
      const completions = getCompletionsForPosition(sql, 'm.', mockSchema);

      // Only columns for alias 'm' should match
      const labels = completions.map((c) => c.label);
      expect(labels).toContain('m.movie_id');
      expect(labels).toContain('m.title');
      expect(labels).toContain('m.release_year');
      expect(labels).not.toContain('r.score');
      expect(labels).not.toContain('r.comment');

      // insertText should be the column name, resulting in m.title rather than m.m.title
      const titleItem = completions.find((c) => c.label === 'm.title');
      expect(titleItem?.insertText).toBe('title');

      const idItem = completions.find((c) => c.label === 'm.movie_id');
      expect(idItem?.insertText).toBe('movie_id');

      // Keywords and tables should not appear for m.
      expect(completions.filter((c) => c.kind === 14)).toHaveLength(0);
      expect(completions.filter((c) => c.kind === 5)).toHaveLength(0);
    });

    it('should filter columns by prefix after alias dot (e.g. m.tit -> m.title)', () => {
      const sql = 'SELECT m. FROM movies m JOIN reviews r ON r.movie_id = m.movie_id';
      const completions = getCompletionsForPosition(sql, 'm.tit', mockSchema);

      expect(completions).toHaveLength(1);
      expect(completions[0].label).toBe('m.title');
      expect(completions[0].insertText).toBe('title');
    });

    it('should filter columns by column name prefix when no alias prefix is typed', () => {
      const sql = 'SELECT FROM movies m JOIN reviews r ON r.movie_id = m.movie_id';
      const completions = getCompletionsForPosition(sql, 'sc', mockSchema);

      expect(completions.map((c) => c.label)).toContain('r.score');
      expect(completions.find((c) => c.label === 'r.score')?.insertText).toBe('score');
      expect(completions.map((c) => c.label)).not.toContain('m.title');
    });
  });

  describe('SqlEditor Component & Monaco Theme', () => {
    it('should render SQL editor header and mock editor container with sql-dark theme', () => {
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
      expect(editorEl?.getAttribute('data-theme')).toBe('sql-dark');
    });

    it('should define sql-dark custom theme with #0B0D10 background and accent styles', () => {
      const mockMonaco = {
        editor: {
          defineTheme: vi.fn(),
        },
      };

      defineSqlDarkTheme(mockMonaco);

      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith(
        'sql-dark',
        expect.objectContaining({
          base: 'vs-dark',
          colors: {
            'editor.background': '#0B0D10',
            'editor.lineHighlightBackground': '#111418',
            'editorCursor.foreground': '#7C9CFF',
          },
        })
      );
    });
  });
});

