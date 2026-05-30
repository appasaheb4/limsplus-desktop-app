/**
 * Hardware / OS snapshot sent with desktop activation (important fields only).
 */

import { app } from 'electron';
import { statfsSync } from 'fs';
import * as os from 'os';
import { machineBindingDigest } from './licenseSecureStorage';

export type DesktopActivationSystemConfig = {
  /** Stable hashed fingerprint for this install + machine. */
  machineId: string;
  hostname: string;
  platform: NodeJS.Platform;
  osVersion: string;
  arch: string;
  macAddresses: string[];
  totalMemoryGb: number;
  freeMemoryGb: number;
  cpuCores: number;
  cpuModel: string;
  storage: {
    path: string;
    totalGb: number;
    freeGb: number;
  } | null;
  appVersion: string;
  product: 'limsplus-connect';
  collectedAt: string;
};

function bytesToGb(bytes: number): number {
  return Math.round((bytes / 1024 ** 3) * 100) / 100;
}

function collectMacAddresses(): string[] {
  const macs = new Set<string>();
  for (const entries of Object.values(os.networkInterfaces())) {
    if (!entries) continue;
    for (const net of entries) {
      const mac = net.mac?.trim().toLowerCase();
      if (!mac || mac === '00:00:00:00:00:00') continue;
      macs.add(mac);
    }
  }
  return [...macs].sort();
}

function collectStorageForPath(targetPath: string): DesktopActivationSystemConfig['storage'] {
  try {
    const stats = statfsSync(targetPath);
    const totalBytes = stats.bsize * stats.blocks;
    const freeBytes = stats.bsize * stats.bfree;
    return {
      path: targetPath,
      totalGb: bytesToGb(totalBytes),
      freeGb: bytesToGb(freeBytes),
    };
  } catch {
    return null;
  }
}

export function getDesktopActivationSystemInfo(): DesktopActivationSystemConfig {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const userDataPath = app.getPath('userData');

  return {
    machineId: machineBindingDigest(),
    hostname: os.hostname(),
    platform: process.platform,
    osVersion: `${os.type()} ${os.release()}`,
    arch: process.arch,
    macAddresses: collectMacAddresses(),
    totalMemoryGb: bytesToGb(totalMem),
    freeMemoryGb: bytesToGb(freeMem),
    cpuCores: cpus.length,
    cpuModel: cpus[0]?.model?.trim() || 'unknown',
    storage: collectStorageForPath(userDataPath),
    appVersion: app.getVersion(),
    product: 'limsplus-connect',
    collectedAt: new Date().toISOString(),
  };
}
