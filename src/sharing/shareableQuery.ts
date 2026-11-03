export interface SharedQueryState {
  sql: string;
  stage: number;
}

const HASH_PREFIX = '#share=';

export function createShareableUrl(sql: string, stage: number, baseUrl = window.location.href): string {
  const url = new URL(baseUrl);
  const state: SharedQueryState = { sql, stage: Math.max(0, Math.floor(stage)) };
  url.hash = `${HASH_PREFIX}${encodeURIComponent(JSON.stringify(state))}`;
  return url.toString();
}

export function readShareableState(hash = window.location.hash): SharedQueryState | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(hash.slice(HASH_PREFIX.length)));
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.sql !== 'string' || typeof candidate.stage !== 'number') return null;
    if (!Number.isFinite(candidate.stage) || candidate.stage < 0) return null;

    return { sql: candidate.sql, stage: Math.floor(candidate.stage) };
  } catch {
    return null;
  }
}
