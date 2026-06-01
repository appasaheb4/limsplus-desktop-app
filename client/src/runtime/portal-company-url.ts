/** Same mapping as LimsPlus portal `getLocalCompanyUrl` (Login chunk). */
export const PORTAL_COMPANY_BASE_URLS: Record<string, string> = {
  ACCUSTIX: 'https://accustix.limsplus.co.in',
  GENEFLOW: 'https://geneflow.limsplus.co.in',
  DEMO: 'https://demo.limsplus.co.in',
  CONFIG: 'https://config.limsplus.co.in',
  TEST: 'https://test.limsplus.co.in',
};

export const PORTAL_COMPANY_URL_DEFAULT = PORTAL_COMPANY_BASE_URLS.GENEFLOW;

const KNOWN_COMPANY_CODES = Object.keys(PORTAL_COMPANY_BASE_URLS);

/**
 * Portal `.env` often bakes every code in one string:
 * `GENEFLOW GENEFLOW ACCUSTIX DEMO CONFIG TEST`
 * Switch needs a single code (`DEMO`), not the whole string.
 */
export function normalizePortalCompanyCode(
  raw: string,
  preferredCode?: string,
): string {
  const preferred = preferredCode?.trim().toUpperCase() ?? '';
  if (preferred && KNOWN_COMPANY_CODES.includes(preferred)) {
    return preferred;
  }

  const upper = raw.trim().toUpperCase();
  if (!upper) return '';
  if (KNOWN_COMPANY_CODES.includes(upper)) return upper;

  if (preferred && upper.includes(preferred)) return preferred;

  const tokens = upper.split(/\s+/).filter(Boolean);
  const knownToken = tokens.find((t) => KNOWN_COMPANY_CODES.includes(t));
  return knownToken ?? '';
}

/**
 * Returns tenant URL (e.g. `https://demo.limsplus.co.in` for `DEMO`).
 * Unknown / empty company → GENEFLOW (portal default).
 */
export function getLocalCompanyUrl(company: string): string {
  const code = normalizePortalCompanyCode(company);
  console.log({ code });
  if (!code) return PORTAL_COMPANY_URL_DEFAULT;
  return PORTAL_COMPANY_BASE_URLS[code] ?? PORTAL_COMPANY_URL_DEFAULT;
}
