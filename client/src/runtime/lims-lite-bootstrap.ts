/**
 * LimsPlus Lite (Electron) opens the static portal with
 * `?limsplusLiteApiBase=http://127.0.0.1:<nestPort>` so GraphQL / REST hit the same
 * Nest origin as the spawned backend — no hard-coded 8080.
 */
export const LIMS_LITE_API_BASE_SS_KEY = 'limsplusLiteApiBase';

const QUERY_KEYS = ['limsplusLiteApiBase', 'liteApiBase'] as const;

/** Captures lite API origin from URL, persists it, strips query (router-safe). Runs on import when `window` exists. */
function captureLiteApiBaseFromQuery(): void {
  if (typeof window === 'undefined') return;
  try {
    const sp = new URLSearchParams(window.location.search);
    let raw = '';
    for (const key of QUERY_KEYS) {
      const v = sp.get(key)?.trim();
      if (v) {
        raw = v.replace(/\/$/, '');
        break;
      }
    }
    if (!raw) return;
    sessionStorage.setItem(LIMS_LITE_API_BASE_SS_KEY, raw);
    for (const key of QUERY_KEYS) {
      sp.delete(key);
    }
    const q = sp.toString();
    const next =
      `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    /* ignore */
  }
}

captureLiteApiBaseFromQuery();

/** Loopback Nest base (no trailing slash), e.g. `http://127.0.0.1:8080`. */
export function getLimsLiteApiBase(): string | undefined {
  try {
    const v = sessionStorage.getItem(LIMS_LITE_API_BASE_SS_KEY)?.trim();
    const t = v?.replace(/\/$/, '');
    return t || undefined;
  } catch {
    return undefined;
  }
}
