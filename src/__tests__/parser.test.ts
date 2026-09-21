import { describe, it, expect } from 'vitest';
import {
  parseQueryAST,
  extractAliasMap,
  extractPipelineStages,
  extractPredicateTree,
  buildPredicateTree,
} from '../parser/sqlParser';

describe('SQL Parser & AST Analyzer', () => {
  describe('extractAliasMap', () => {
    it('should extract aliases correctly with implicit AS', () => {
      const sql = 'SELECT m.title FROM movies m JOIN reviews r ON r.movie_id = m.movie_id WHERE r.score >= 7';
      const aliases = extractAliasMap(sql);
      expect(aliases).toEqual({ m: 'movies', r: 'reviews' });
    });

    it('should extract aliases with explicit AS keyword', () => {
      const sql = 'SELECT m.title FROM movies AS m JOIN reviews AS r ON r.movie_id = m.movie_id';
      const aliases = extractAliasMap(sql);
      expect(aliases).toEqual({ m: 'movies', r: 'reviews' });
    });

    it('should map table name to itself when no alias is provided', () => {
      const sql = 'SELECT title FROM movies JOIN reviews ON reviews.movie_id = movies.movie_id';
      const aliases = extractAliasMap(sql);
      expect(aliases).toEqual({ movies: 'movies', reviews: 'reviews' });
    });

    it('should extract aliases via regex fallback if AST parser encounters non-standard syntax', () => {
      const sql = 'SELECT * FROM special_table st JOIN another_tbl at ON st.id = at.id WHERE non_standard %%% syntax';
      const aliases = extractAliasMap(sql);
      expect(aliases.st).toBe('special_table');
      expect(aliases.at).toBe('another_tbl');
    });
  });

  describe('extractPipelineStages', () => {
    it('should extract pipeline stages in logical execution order', () => {
      const sql =
        'SELECT m.title, AVG(r.score) AS average_score FROM movies m JOIN reviews r ON r.movie_id = m.movie_id WHERE r.score >= 7 GROUP BY m.title ORDER BY average_score DESC LIMIT 5';
      const stages = extractPipelineStages(sql);
      expect(stages).toEqual(['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'SELECT', 'ORDER BY', 'LIMIT']);
    });

    it('should include DISTINCT and HAVING when present in logical order', () => {
      const sql =
        'SELECT DISTINCT m.title FROM movies m JOIN reviews r ON r.movie_id = m.movie_id WHERE r.score >= 7 GROUP BY m.title HAVING COUNT(r.review_id) > 1 ORDER BY m.title LIMIT 10';
      const stages = extractPipelineStages(sql);
      expect(stages).toEqual(['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'DISTINCT', 'ORDER BY', 'LIMIT']);
    });

    it('should handle simple SELECT query with minimal stages', () => {
      const sql = 'SELECT title FROM movies';
      const stages = extractPipelineStages(sql);
      expect(stages).toEqual(['FROM', 'SELECT']);
    });
  });

  describe('parseQueryAST', () => {
    it('should parse valid SQL into an AST object', () => {
      const sql = 'SELECT title, year FROM movies WHERE year > 2000';
      const ast = parseQueryAST(sql);
      expect(ast).toBeDefined();
      const astObj = Array.isArray(ast) ? ast[0] : ast;
      expect(astObj.type).toBe('select');
    });

    it('should throw an error for invalid SQL syntax', () => {
      const sql = 'SELEC FROM WHERE ???';
      expect(() => parseQueryAST(sql)).toThrow();
    });
  });

  describe('extractPredicateTree & buildPredicateTree', () => {
    it('should extract binary predicate tree from simple WHERE clause', () => {
      const sql = 'SELECT * FROM reviews r WHERE r.score >= 7';
      const tree = extractPredicateTree(sql);
      expect(tree).toEqual({
        type: 'binary',
        operator: '>=',
        left: { type: 'column', columnName: 'r.score' },
        right: { type: 'literal', value: 7 },
      });
    });

    it('should extract compound predicate tree with AND / OR operators', () => {
      const sql = "SELECT * FROM movies m WHERE m.year > 2000 AND m.genre = 'Sci-Fi'";
      const tree = extractPredicateTree(sql);
      expect(tree).toBeDefined();
      expect(tree?.type).toBe('binary');
      expect(tree?.operator).toBe('AND');
      expect(tree?.left).toEqual({
        type: 'binary',
        operator: '>',
        left: { type: 'column', columnName: 'm.year' },
        right: { type: 'literal', value: 2000 },
      });
      expect(tree?.right).toEqual({
        type: 'binary',
        operator: '=',
        left: { type: 'column', columnName: 'm.genre' },
        right: { type: 'literal', value: 'Sci-Fi' },
      });
    });

    it('should return undefined when query has no WHERE clause', () => {
      const sql = 'SELECT * FROM movies';
      const tree = extractPredicateTree(sql);
      expect(tree).toBeUndefined();
    });

    it('should return undefined when expr is null or undefined in buildPredicateTree', () => {
      expect(buildPredicateTree(null)).toBeUndefined();
      expect(buildPredicateTree(undefined)).toBeUndefined();
    });
  });
});
