import { QueryHistoryItem, SavedSnippet } from '../types';

const DB_NAME = 'sql_viewer_db';
const DB_VERSION = 1;

const STORE_HISTORY = 'history';
const STORE_SNIPPETS = 'snippets';

// In-memory fallback if IndexedDB is unavailable
const memoryHistoryStore = new Map<string, QueryHistoryItem>();
const memorySnippetStore = new Map<string, SavedSnippet>();

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (_event: IDBVersionChangeEvent) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SNIPPETS)) {
          db.createObjectStore(STORE_SNIPPETS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function addHistoryItem(item: QueryHistoryItem): Promise<void> {
  const db = await openDB();
  if (!db) {
    memoryHistoryStore.set(item.id, item);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    const request = store.put(item);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
}

export async function getHistoryItems(): Promise<QueryHistoryItem[]> {
  const db = await openDB();
  if (!db) {
    const items = Array.from(memoryHistoryStore.values());
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readonly');
    const store = tx.objectStore(STORE_HISTORY);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result || []) as QueryHistoryItem[];
      items.sort((a, b) => b.timestamp - a.timestamp);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearHistoryItems(): Promise<void> {
  const db = await openDB();
  if (!db) {
    memoryHistoryStore.clear();
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    const request = store.clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSnippet(snippet: SavedSnippet): Promise<void> {
  const db = await openDB();
  if (!db) {
    memorySnippetStore.set(snippet.id, snippet);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNIPPETS, 'readwrite');
    const store = tx.objectStore(STORE_SNIPPETS);
    const request = store.put(snippet);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
}

export async function getSnippets(): Promise<SavedSnippet[]> {
  const db = await openDB();
  if (!db) {
    const items = Array.from(memorySnippetStore.values());
    items.sort((a, b) => b.createdAt - a.createdAt);
    return items;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNIPPETS, 'readonly');
    const store = tx.objectStore(STORE_SNIPPETS);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result || []) as SavedSnippet[];
      items.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSnippet(id: string): Promise<void> {
  const db = await openDB();
  if (!db) {
    memorySnippetStore.delete(id);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNIPPETS, 'readwrite');
    const store = tx.objectStore(STORE_SNIPPETS);
    const request = store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
}
