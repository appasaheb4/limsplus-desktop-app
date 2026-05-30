/**
 * Runtime `REACT_APP_LOCAL_LOGIN_COMPANY` from activation `company.code`.
 * Always a plain string (e.g. `DEMO`), never a profile object.
 */

import {
  getLocalCompanyUrl as resolvePortalCompanyUrl,
  getLocalCompanyUrl,
  normalizePortalCompanyCode,
  PORTAL_COMPANY_BASE_URLS,
  PORTAL_COMPANY_URL_DEFAULT,
} from './portal-company-url';

export {
  getLocalCompanyUrl,
  normalizePortalCompanyCode,
  PORTAL_COMPANY_BASE_URLS,
  PORTAL_COMPANY_URL_DEFAULT,
};

export const LOCAL_LOGIN_COMPANY_SS_KEY = 'REACT_APP_LOCAL_LOGIN_COMPANY';

const QUERY_KEYS = [
  'localLoginCompany',
  'REACT_APP_LOCAL_LOGIN_COMPANY',
] as const;

const WINDOW_RUNTIME_KEY = '__LIMSPLUS_REACT_APP_LOCAL_LOGIN_COMPANY__';

declare global {
  interface Window {
    [WINDOW_RUNTIME_KEY]?: string;
  }
}

/** Normalize API/store/session values to a single company code string. */
export function coerceToCompanyCodeString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return '';
    if (
      (t.startsWith('{') && t.endsWith('}')) ||
      (t.startsWith('[') && t.endsWith(']'))
    ) {
      try {
        return coerceToCompanyCodeString(JSON.parse(t));
      } catch {
        return t;
      }
    }
    return t;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    return (
      coerceToCompanyCodeString(o.code) ||
      coerceToCompanyCodeString(o.companyCode) ||
      coerceToCompanyCodeString(o.REACT_APP_LOCAL_LOGIN_COMPANY) ||
      ''
    );
  }
  return '';
}

export function setLocalLoginCompanyCode(
  code: string | null | undefined | Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  const trimmed = coerceToCompanyCodeString(code);
  try {
    if (trimmed) {
      sessionStorage.setItem(LOCAL_LOGIN_COMPANY_SS_KEY, trimmed);
      window[WINDOW_RUNTIME_KEY] = trimmed;
    } else {
      sessionStorage.removeItem(LOCAL_LOGIN_COMPANY_SS_KEY);
      delete window[WINDOW_RUNTIME_KEY];
    }
  } catch {
    /* ignore */
  }
}

/**
 * Runtime company code only (same as `.env` value, e.g. `DEMO`).
 * Order: sessionStorage → window mirror → build-time `.env`
 */
export function getReactAppLocalLoginCompany(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(LOCAL_LOGIN_COMPANY_SS_KEY);
      const fromSession = coerceToCompanyCodeString(stored);
      if (fromSession) return fromSession;
    } catch {
      /* ignore */
    }
    const fromWindow = coerceToCompanyCodeString(window[WINDOW_RUNTIME_KEY]);
    if (fromWindow) return fromWindow;
  }
  return coerceToCompanyCodeString(process.env.REACT_APP_LOCAL_LOGIN_COMPANY);
}

/** @deprecated Use `getReactAppLocalLoginCompany` */
export const getLocalLoginCompanyCode = getReactAppLocalLoginCompany;

/** Load `company.code` from Electron store (string only). */
export async function refreshLocalLoginCompanyFromStore(): Promise<string> {
  if (typeof window === 'undefined') return '';
  try {
    const ipcRenderer = window.require('electron').ipcRenderer as {
      invoke: (channel: string) => Promise<unknown>;
    };
    const fromStore = await ipcRenderer.invoke('get-local-login-company');
    const trimmed = coerceToCompanyCodeString(fromStore);
    if (trimmed) {
      setLocalLoginCompanyCode(trimmed);
    }
    return getReactAppLocalLoginCompany();
  } catch (err: unknown) {
    console.warn(
      '[LimsPlus Connect] refreshLocalLoginCompanyFromStore failed:',
      err,
    );
    return getReactAppLocalLoginCompany();
  }
}

/** Portal Lite: read company code from URL query, persist, strip from address bar. */
function captureLocalLoginCompanyFromQuery(): void {
  if (typeof window === 'undefined') return;
  try {
    const sp = new URLSearchParams(window.location.search);
    let raw = '';
    for (const key of QUERY_KEYS) {
      const v = sp.get(key)?.trim();
      if (v) {
        raw = v;
        break;
      }
    }
    const code = coerceToCompanyCodeString(raw);
    if (!code) return;
    sessionStorage.setItem(LOCAL_LOGIN_COMPANY_SS_KEY, code);
    window[WINDOW_RUNTIME_KEY] = code;
    for (const key of QUERY_KEYS) {
      sp.delete(key);
    }
    const q = sp.toString();
    const next = `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    /* ignore */
  }
}

captureLocalLoginCompanyFromQuery();

/** Tenant URL from stored activation code (`getReactAppLocalLoginCompany`). */
export function getLocalCompanyUrlFromRuntime(): string {
  return resolvePortalCompanyUrl(getReactAppLocalLoginCompany());
}

declare global {
  interface Window {
    getLocalCompanyUrl?: (company: string) => string;
    getLocalCompanyUrlFromRuntime?: () => string;
  }
}

if (typeof window !== 'undefined') {
  window.getLocalCompanyUrl = getLocalCompanyUrl;
  window.getLocalCompanyUrlFromRuntime = getLocalCompanyUrlFromRuntime;
}
