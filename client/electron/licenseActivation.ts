/**
 * Product activation (license key). REST verification is stubbed for now.
 * Replace {@link verifyActivationKeyViaApi} body with a real HTTP call later.
 *
 * The activation key is never written to disk — see {@link licenseSecureStorage.ts}.
 */

/** Dev / offline dummy key until REST license API is wired (do not log this value). */
const DUMMY_VALID_ACTIVATION_KEY = 'LimsPlus@123';

export type ActivationVerifyResult = {
  valid: boolean;
  message: string;
};

function simulateNetworkDelayMs(): number {
  const raw = process.env.LIMSPLUS_ACTIVATION_VERIFY_DELAY_MS ?? '500';
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 500;
}

/**
 * Verify activation key (dummy: exact match to {@link DUMMY_VALID_ACTIVATION_KEY}).
 *
 * Future REST example:
 *   POST ${LIMSPLUS_LICENSE_VERIFY_URL}/api/license/activate
 *   body: { activationKey, machineId?, product: 'limsplus-connect' }
 */
export async function verifyActivationKeyViaApi(
  activationKey: string,
): Promise<ActivationVerifyResult> {
  const key = activationKey.trim();
  if (!key.length) {
    return { valid: false, message: 'Please enter your activation key.' };
  }

  await new Promise((r) => setTimeout(r, simulateNetworkDelayMs()));

  const apiUrl = process.env.LIMSPLUS_LICENSE_VERIFY_URL?.trim();
  if (apiUrl) {
    // Placeholder for real integration — fall through to dummy until implemented.
    console.warn(
      '[LimsPlus] LIMSPLUS_LICENSE_VERIFY_URL is set but REST license verify is not implemented yet; using dummy validator.',
    );
  }

  if (key === DUMMY_VALID_ACTIVATION_KEY) {
    return {
      valid: true,
      message: 'Thank you. Your license is active and stored securely on this device.',
    };
  }

  return {
    valid: false,
    message: 'Invalid activation key. Contact your administrator or try again.',
  };
}
