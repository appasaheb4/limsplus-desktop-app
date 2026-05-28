/**
 * Secure license activation state — never stores the plaintext activation key.
 *
 * - Activation key exists only in memory during verify, then discarded.
 * - Persisted: SHA-256 fingerprint (one-way) + HMAC integrity + machine binding.
 * - Payload encrypted with Electron safeStorage (OS keychain / DPAPI) when available,
 *   else AES-256-GCM with scrypt-derived key bound to this machine + app data path.
 */

import { app, safeStorage } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ACTIVATION_FILE_BASENAME = 'license-activation.secure';
const RECORD_VERSION = 1;
const HEADER_SAFE = 'SS:v1:';
const HEADER_AES = 'AE:v1:';

type ActivationRecord = {
  v: number;
  activatedAt: string;
  /** SHA-256 hex of activation key — not reversible to the key. */
  keyFingerprint: string;
  machineBinding: string;
  integrity: string;
};

function activationFilePath(): string {
  return path.join(app.getPath('userData'), ACTIVATION_FILE_BASENAME);
}

function appPepper(): Buffer {
  const pepper =
    process.env.LIMSPLUS_LICENSE_INTEGRITY_PEPPER?.trim() ||
    'limsplus-connect-v1-license-integrity-pepper';
  return crypto.createHash('sha256').update(pepper).digest();
}

/** Binds license file to this install + machine (copying file to another PC fails). */
export function machineBindingDigest(): string {
  const parts = [
    app.getName(),
    app.getPath('userData'),
    os.hostname(),
    os.userInfo().username,
    process.platform,
    process.arch,
  ].join('|');
  return crypto.createHash('sha256').update(parts).digest('hex');
}

export function activationKeyFingerprint(activationKey: string): string {
  return crypto
    .createHash('sha256')
    .update(activationKey.trim(), 'utf8')
    .digest('hex');
}

function buildRecord(keyFingerprintHex: string): ActivationRecord {
  const base = {
    v: RECORD_VERSION,
    activatedAt: new Date().toISOString(),
    keyFingerprint: keyFingerprintHex,
    machineBinding: machineBindingDigest(),
  };
  const integrity = crypto
    .createHmac('sha256', appPepper())
    .update(
      JSON.stringify({
        v: base.v,
        activatedAt: base.activatedAt,
        keyFingerprint: base.keyFingerprint,
        machineBinding: base.machineBinding,
      }),
    )
    .digest('hex');
  return { ...base, integrity };
}

function verifyRecord(record: ActivationRecord): boolean {
  if (record.v !== RECORD_VERSION) return false;
  if (record.machineBinding !== machineBindingDigest()) return false;
  const expected = crypto
    .createHmac('sha256', appPepper())
    .update(
      JSON.stringify({
        v: record.v,
        activatedAt: record.activatedAt,
        keyFingerprint: record.keyFingerprint,
        machineBinding: record.machineBinding,
      }),
    )
    .digest('hex');
  if (
    typeof record.integrity !== 'string' ||
    record.integrity.length !== expected.length
  ) {
    return false;
  }
  try {
    const a = Buffer.from(record.integrity, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function deriveAesKey(salt: Buffer): Buffer {
  const material = Buffer.concat([
    appPepper(),
    Buffer.from(machineBindingDigest(), 'hex'),
    salt,
  ]);
  return crypto.scryptSync(material, salt, 32);
}

function encryptWithAesGcm(plaintext: string): Buffer {
  const salt = crypto.randomBytes(16);
  const key = deriveAesKey(salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([salt, iv, tag, enc]);
  return Buffer.concat([Buffer.from(HEADER_AES, 'utf8'), payload]);
}

function decryptWithAesGcm(buf: Buffer): string | null {
  try {
    const raw = buf.subarray(Buffer.from(HEADER_AES, 'utf8').length);
    if (raw.length < 16 + 12 + 16 + 1) return null;
    const salt = raw.subarray(0, 16);
    const iv = raw.subarray(16, 28);
    const tag = raw.subarray(28, 44);
    const data = raw.subarray(44);
    const key = deriveAesKey(salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

function encryptPayload(plaintext: string): Buffer {
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(plaintext);
    return Buffer.concat([Buffer.from(HEADER_SAFE, 'utf8'), enc]);
  }
  return encryptWithAesGcm(plaintext);
}

function decryptPayload(fileBuf: Buffer): string | null {
  const asStr = fileBuf.subarray(0, 16).toString('utf8');
  if (asStr.startsWith(HEADER_SAFE)) {
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(fileBuf.subarray(HEADER_SAFE.length));
    } catch {
      return null;
    }
  }
  if (asStr.startsWith(HEADER_AES)) {
    return decryptWithAesGcm(fileBuf);
  }
  return null;
}

function readRecord(): ActivationRecord | null {
  const fp = activationFilePath();
  if (!fs.existsSync(fp)) return null;
  try {
    const fileBuf = fs.readFileSync(fp);
    const plain = decryptPayload(fileBuf);
    if (!plain) return null;
    const record = JSON.parse(plain) as ActivationRecord;
    if (!verifyRecord(record)) return null;
    return record;
  } catch {
    return null;
  }
}

/** True when a valid, untampered activation blob exists for this machine. */
export function isLicenseSecurelyActivated(): boolean {
  return readRecord() !== null;
}

/**
 * Save activation proof after successful API verify.
 * Does **not** store the plaintext activation key.
 */
export function persistSecureActivationRecord(activationKey: string): void {
  const record = buildRecord(activationKeyFingerprint(activationKey));
  const plain = JSON.stringify(record);
  const enc = encryptPayload(plain);
  const fp = activationFilePath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, enc, { mode: 0o600 });
  try {
    fs.chmodSync(fp, 0o600);
  } catch {
    /* Windows may ignore */
  }
}

/** One-time migration from legacy `licenseActivated: true` in user-preferences.json. */
export function migrateLegacyPlaintextFlag(wasActivated: boolean): void {
  if (!wasActivated || isLicenseSecurelyActivated()) return;
  const record = buildRecord('legacy-migrated-no-plaintext-key-stored');
  const plain = JSON.stringify(record);
  fs.writeFileSync(activationFilePath(), encryptPayload(plain), {
    mode: 0o600,
  });
}

export function clearSecureActivationRecord(): void {
  const fp = activationFilePath();
  if (fs.existsSync(fp)) {
    try {
      fs.unlinkSync(fp);
    } catch {
      /* ignore */
    }
  }
}
