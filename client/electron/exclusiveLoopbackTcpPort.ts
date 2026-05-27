import { listenLoopbackProbe } from './loopbackTcpPort';
import { killTcpListenersOnPort } from './killLoopbackPortOccupiers';
import { setTimeout as delay } from 'timers/promises';

export type ResolveExclusiveLoopbackTcpPortOptions = {
  /** Raw `process.env` value for the port variable (may be empty). */
  rawPortEnv: string | undefined;
  defaultPort: number;
  /** When true, only probe once — do not kill other listeners. */
  skipKillOccupiers: boolean;
  /** Log / error label, e.g. `MongoDB` or `Nest API`. */
  roleLabel: string;
  /** Name of the port env var (for error text), e.g. `LIMS_LITE_MONGO_PORT`. */
  portEnvVarName: string;
  /** Name of the opt-out env var (for error text). */
  skipKillEnvVarName: string;
};

/**
 * Binds a fixed loopback TCP port: probe → optionally kill LISTEN PIDs → retry.
 * **`rawPortEnv`** `0` or `auto` → OS ephemeral port (no kill).
 */
export async function resolveExclusiveLoopbackTcpPort(
  opts: ResolveExclusiveLoopbackTcpPortOptions,
): Promise<number> {
  const rawOrig = (opts.rawPortEnv ?? '').trim();
  const rawLc = rawOrig.toLowerCase();
  if (rawLc === '0' || rawLc === 'auto') {
    return listenLoopbackProbe(0);
  }

  let port = opts.defaultPort;
  const fromEnv = Number.parseInt(rawOrig, 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    port = fromEnv;
  }

  const maxAttempts = opts.skipKillOccupiers ? 1 : 3;

  /**
   * Always try to clear LISTEN occupiers first (then probe). Fixes races where a
   * brief successful probe still leaves another process bound before Nest/mongod starts.
   */
  if (!opts.skipKillOccupiers) {
    const pre = await killTcpListenersOnPort(port);
    if (pre.attempted && pre.pids.length > 0) {
      console.warn(
        `[LimsPlus Lite] Pre-freed ${opts.roleLabel} port ${port} (PID(s): ${pre.pids.join(', ')})`,
      );
    }
    await delay(400);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await listenLoopbackProbe(port);
      return port;
    } catch {
      const lastRound = attempt === maxAttempts - 1;
      if (lastRound) {
        throw new Error(
          `[LimsPlus Lite] ${opts.roleLabel} needs 127.0.0.1:${port} but it stayed busy.\n` +
            (opts.skipKillOccupiers
              ? `Another process holds the port, or kill is disabled (**${opts.skipKillEnvVarName}**).\n`
              : `Could not bind after attempting to stop other listeners — try admin run, stop the conflicting service manually, or set **${opts.portEnvVarName}** to a free port.\n`) +
            `• Escape hatch (random port): **${opts.portEnvVarName}=auto**`,
        );
      }
      if (opts.skipKillOccupiers) {
        throw new Error(
          `[LimsPlus Lite] ${opts.roleLabel} needs 127.0.0.1:${port} but it is in use (kill disabled). Free the port or set **${opts.portEnvVarName}** / **auto**.`,
        );
      }

      const killed = await killTcpListenersOnPort(port);
      if (!killed.attempted || killed.pids.length === 0) {
        throw new Error(
          `[LimsPlus Lite] Port ${port} is in use; no LISTEN PID could be found to stop (${opts.roleLabel}).\n` +
            `Install **lsof** (macOS/Linux) or stop the conflicting process manually.`,
        );
      }
      console.warn(
        `[LimsPlus Lite] Freed ${opts.roleLabel} port ${port} (stopped PID(s): ${killed.pids.join(', ')}).`,
      );
    }
  }

  throw new Error(
    `[LimsPlus Lite] Unexpected: ${opts.roleLabel} listen port resolution failed.`,
  );
}
