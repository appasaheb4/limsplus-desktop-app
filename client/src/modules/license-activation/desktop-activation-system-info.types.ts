/** Matches payload from Electron `get-desktop-activation-system-info`. */
export type DesktopActivationSystemConfig = {
  machineId: string;
  hostname: string;
  platform: string;
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
