/**
 * Served by Electron at /lims-portal-desktop-bootstrap.js (not in replaceable app/frontend).
 * Matches portal getLocalCompanyUrl switch; normalizes baked multi-company .env strings.
 */
(function () {
  var COMPANY_QUERY = ['localLoginCompany', 'REACT_APP_LOCAL_LOGIN_COMPANY'];
  var API_QUERY = ['limsplusLiteApiBase', 'liteApiBase'];
  var SS_COMPANY = 'REACT_APP_LOCAL_LOGIN_COMPANY';
  var SS_API = 'limsplusLiteApiBase';

  var PORTAL_COMPANY_BASE_URLS = {
    ACCUSTIX: 'https://accustix.limsplus.co.in',
    GENEFLOW: 'https://geneflow.limsplus.co.in',
    DEMO: 'https://demo.limsplus.co.in',
    CONFIG: 'https://config.limsplus.co.in',
    TEST: 'https://test.limsplus.co.in',
  };
  var PORTAL_DEFAULT = PORTAL_COMPANY_BASE_URLS.GENEFLOW;
  var KNOWN = Object.keys(PORTAL_COMPANY_BASE_URLS);

  function trim(v) {
    return v && String(v).trim ? String(v).trim() : '';
  }

  function normalizePortalCompanyCode(raw, preferredCode) {
    var preferred = trim(preferredCode).toUpperCase();
    if (preferred && KNOWN.indexOf(preferred) >= 0) return preferred;

    var upper = trim(raw).toUpperCase();
    if (!upper) return '';
    if (KNOWN.indexOf(upper) >= 0) return upper;
    if (preferred && upper.indexOf(preferred) >= 0) return preferred;

    var tokens = upper.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      if (KNOWN.indexOf(tokens[i]) >= 0) return tokens[i];
    }
    return '';
  }

  /** Same as portal source: switch(company) → https://{tenant}.limsplus.co.in */
  function getLocalCompanyUrl(company) {
    var code = normalizePortalCompanyCode(company);
    if (!code) return PORTAL_DEFAULT;
    return PORTAL_COMPANY_BASE_URLS[code] || PORTAL_DEFAULT;
  }

  function applyCompanyToEnv(company, preferredCode) {
    var code = normalizePortalCompanyCode(company, preferredCode);
    if (!code) return;
    try {
      sessionStorage.setItem(SS_COMPANY, code);
    } catch (e) {}
    window.process = window.process || { env: {} };
    window.process.env = window.process.env || {};
    window.process.env.REACT_APP_LOCAL_LOGIN_COMPANY = code;
  }

  function applyApiBase(apiBase) {
    apiBase = trim(apiBase).replace(/\/$/, '');
    if (!apiBase) return;
    try {
      sessionStorage.setItem(SS_API, apiBase);
    } catch (e) {}
  }

  function firstFromQuery(keys) {
    try {
      var sp = new URLSearchParams(window.location.search);
      for (var i = 0; i < keys.length; i++) {
        var v = trim(sp.get(keys[i]));
        if (v) return v;
      }
    } catch (e) {}
    return '';
  }

  function stripQueryKeys(keys) {
    try {
      var sp = new URLSearchParams(window.location.search);
      var changed = false;
      for (var i = 0; i < keys.length; i++) {
        if (sp.has(keys[i])) {
          sp.delete(keys[i]);
          changed = true;
        }
      }
      if (!changed) return;
      var q = sp.toString();
      var next =
        window.location.pathname + (q ? '?' + q : '') + window.location.hash;
      window.history.replaceState({}, '', next);
    } catch (e) {}
  }

  function loadRuntimeConfigSync() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/lims-desktop-runtime-config.json', false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
        return JSON.parse(xhr.responseText);
      }
    } catch (e) {}
    return null;
  }

  window.getLocalCompanyUrl = getLocalCompanyUrl;
  window.normalizePortalCompanyCode = normalizePortalCompanyCode;

  var cfg = loadRuntimeConfigSync();
  var preferred =
    cfg && typeof cfg === 'object' ? trim(cfg.localLoginCompany) : '';

  /** Electron runtime config wins over URL query and stale sessionStorage. */
  var company = preferred || firstFromQuery(COMPANY_QUERY);
  var apiBase = firstFromQuery(API_QUERY);
  if (!apiBase && cfg && typeof cfg === 'object')
    apiBase = trim(cfg.apiBaseUrl);
  if (company) applyCompanyToEnv(company, preferred);
  if (apiBase) applyApiBase(apiBase);
  stripQueryKeys(COMPANY_QUERY.concat(API_QUERY));
})();
