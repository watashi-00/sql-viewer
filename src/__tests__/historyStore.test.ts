import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addHistoryItem,
  getHistoryItems,
  clearHistoryItems,
  saveSnippet,
  getSnippets,
  deleteSnippet
} from '../storage/historyStore';
import { QueryHistoryItem, SavedSnippet } from '../types';

describe('HistoryStore Infrastructure', () => {
  beforeEach(async () => {
    await clearHistoryItems();
  });

  it('should store and retrieve query history items', async () => {
    const item: QueryHistoryItem = {
      id: 'h-1',
      sql: 'SELECT * FROM movies;',
      timestamp: Date.now(),
      durationMs: 12.5,
      rowCount: 5,
      status: 'success'
    };

    await addHistoryItem(item);
    const items = await getHistoryItems();

    expect(items.length).toBe(1);
    expect(items[0].sql).toBe('SELECT * FROM movies;');
  });

  it('should clear query history items', async () => {
    const item: QueryHistoryItem = {
      id: 'h-2',
      sql: 'SELECT 1;',
      timestamp: Date.now(),
      durationMs: 1.0,
      rowCount: 1,
      status: 'success'
    };

    await addHistoryItem(item);
    expect((await getHistoryItems()).length).toBe(1);

    await clearHistoryItems();
    expect((await getHistoryItems()).length).toBe(0);
  });

  it('should save, retrieve, and delete saved snippets', async () => {
    const snippet: SavedSnippet = {
      id: 's-1',
      title: 'Top Movies Query',
      sql: 'SELECT * FROM movies WHERE rating > 8.0;',
      description: 'Find top rated movies',
      tags: ['movies', 'top-rated'],
      createdAt: Date.now()
    };

    await saveSnippet(snippet);
    let snippets = await getSnippets();

    expect(snippets.length).toBe(1);
    expect(snippets[0].title).toBe('Top Movies Query');
    expect(snippets[0].tags).toContain('top-rated');

    await deleteSnippet('s-1');
    snippets = await getSnippets();
    expect(snippets.length).toBe(0);
  });
});
