/** Flattened company profile from `activationDesktopApp` (stored in user-preferences). */
export type DesktopActivationProfile = {
  desktopAppConfiguration?: {
    [key: string]: unknown;
    sessionDetails?: {
      systemConfig?: {
        clientName?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
  };
  name?: string;
  code?: string;
  companyCode?: string;
  environment?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  mobileNo?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  gstNo?: string;
  panNo?: string;
  [key: string]: unknown;
};

function pickString(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

/** Reads `company.name`, `result.company`, `companyList[0]`, etc. */
export function normalizeActivationProfile(
  raw: unknown,
): DesktopActivationProfile | null {
  if (!raw || typeof raw !== 'object') return null;

  let record = raw as Record<string, unknown>;

  if (
    record.company &&
    typeof record.company === 'object' &&
    !Array.isArray(record.company)
  ) {
    record = record.company as Record<string, unknown>;
  } else if (
    record.result &&
    typeof record.result === 'object' &&
    !Array.isArray(record.result)
  ) {
    const result = record.result as Record<string, unknown>;
    if (
      result.company &&
      typeof result.company === 'object' &&
      !Array.isArray(result.company)
    ) {
      record = result.company as Record<string, unknown>;
    } else {
      record = result;
    }
  }

  const list = record.companyList;
  if (Array.isArray(list) && list.length > 0) {
    const first = list[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      record = first as Record<string, unknown>;
    }
  }

  if (Object.keys(record).length === 0) return null;

  return {
    ...record,
    // name:
    //   pickString(record, 'name', 'companyName', 'company_name', 'orgName') ??
    //   undefined,
    // code:
    //   pickString(record, 'code', 'companyCode', 'company_code') ?? undefined,
    // email: pickString(record, 'email', 'contactEmail', 'mail') ?? undefined,
    // mobile:
    //   pickString(
    //     record,
    //     'mobile',
    //     'mobileNo',
    //     'mobile_no',
    //     'phone',
    //     'contactMobile',
    //   ) ?? undefined,
    // phone:
    //   pickString(record, 'phone', 'mobile', 'mobileNo', 'telephone') ??
    //   undefined,
    // environment: pickString(record, 'environment', 'env') ?? undefined,
  };
}

export function buildProfileForStorage(
  apiBody: unknown,
): DesktopActivationProfile {
  const normalized = normalizeActivationProfile(apiBody);
  if (normalized) return normalized;
  return normalizeActivationProfile({ company: apiBody }) ?? {};
}

export function hasActivationProfileContent(
  profile: DesktopActivationProfile | null | undefined,
): profile is DesktopActivationProfile {
  if (!profile || typeof profile !== 'object') return false;
  return activationProfileLabel(profile) !== '';
}

export function extractLocalLoginCompanyCode(
  profile: DesktopActivationProfile | null | undefined,
): string {
  if (!profile) return '';
  const code = profile.code ?? profile.companyCode;
  if (typeof code === 'string' && code.trim()) return code.trim();
  if (typeof code === 'number' && Number.isFinite(code)) return String(code);
  return '';
}

export function activationProfileLabel(
  profile: DesktopActivationProfile | null | undefined,
): string {
  if (!profile) return '';
  const name = profile.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  const code = profile.code ?? profile.companyCode;
  if (typeof code === 'string' && code.trim()) return String(code).trim();
  return '';
}
