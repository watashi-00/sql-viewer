import { describe, it, expect, beforeAll } from 'vitest';
import { seedMoviesDataset, getIntrospectedSchema } from '../database/schema';
import { resetDatabase } from '../database/duckdb';

describe('Schema & Seed Dataset', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedMoviesDataset();
  });

  it('should seed movies dataset and introspect schema', async () => {
    const schema = await getIntrospectedSchema();
    expect(schema.tables.map((t) => t.name)).toContain('movies');
    expect(schema.tables.map((t) => t.name)).toContain('directors');
    expect(schema.tables.map((t) => t.name)).toContain('reviews');

    const moviesTable = schema.tables.find((t) => t.name === 'movies');
    expect(moviesTable?.columns.map((c) => c.name)).toContain('title');
    expect(moviesTable?.columns.find((c) => c.name === 'movie_id')?.isPrimaryKey).toBe(true);
  });

  it('should introspect foreign keys and relations correctly', async () => {
    const schema = await getIntrospectedSchema();
    const moviesTable = schema.tables.find((t) => t.name === 'movies');
    const directorIdCol = moviesTable?.columns.find((c) => c.name === 'director_id');
    expect(directorIdCol?.isForeignKey).toBe(true);
    expect(directorIdCol?.foreignKeyRef).toEqual({
      table: 'directors',
      column: 'director_id',
    });

    const reviewsTable = schema.tables.find((t) => t.name === 'reviews');
    const movieIdCol = reviewsTable?.columns.find((c) => c.name === 'movie_id');
    expect(movieIdCol?.isForeignKey).toBe(true);
    expect(movieIdCol?.foreignKeyRef).toEqual({
      table: 'movies',
      column: 'movie_id',
    });
  });

  it('should introspect row counts accurately', async () => {
    const schema = await getIntrospectedSchema();
    const directorsTable = schema.tables.find((t) => t.name === 'directors');
    const moviesTable = schema.tables.find((t) => t.name === 'movies');
    const reviewsTable = schema.tables.find((t) => t.name === 'reviews');

    expect(directorsTable?.rowCount).toBe(3);
    expect(moviesTable?.rowCount).toBe(5);
    expect(reviewsTable?.rowCount).toBe(8);
  });
});
