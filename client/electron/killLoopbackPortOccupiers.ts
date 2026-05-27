import { execFileSync, spawnSync } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

const isWin = process.platform === 'win32';

function lineMentionsListenPort(line: string, port: number): boolean {
  /** Avoid matching `:8080` inside `:18080`. */
  return new RegExp(`(^|[^0-9]):${port}([^0-9]|$)`).test(line);
}

function spawnText(cmd: string, args: string[], timeoutMs: number): string {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    /** `lsof` exits **1** when no rows match — must not throw away stderr/stdout via execFileSync. */
    shell: false,
  });
  if (typeof r.stdout !== 'string') return '';
  return r.stdout.trimEnd();
}

/**
 * PIDs listening on **`port`** (TCP). macOS/Linux: `lsof` (handles exit code **1**
 * empty set). Windows: **`netstat`**, optional PowerShell fallback.
 */
export function listListenPidsOnTcpPort(port: number): number[] {
  if (port <= 0 || port > 65535) return [];
  if (isWin) return listListenPidsOnWindowsTcp(port);
  return listListenPidsOnUnixTcp(port);
}

function listListenPidsOnUnixTcp(port: number): number[] {
  const pids = new Set<number>();
  /** `-t`: one PID per line; exit **1** if none — spawnSync avoids throw */
  const terse = spawnText(
    'lsof',
    ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
    15_000,
  );
  for (const line of terse.split(/\r?\n/)) {
    const pid = Number.parseInt(line.trim(), 10);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }
  if (pids.size > 0) return [...pids];

  const verbose = spawnText('lsof', ['-nP', `-iTCP:${port}`], 15_000);
  for (const raw of verbose.split(/\r?\n/)) {
    const line = raw.trim();
    if (
      line.length === 0 ||
      line.startsWith('COMMAND') ||
      !lineMentionsListenPort(line, port)
    )
      continue;
    if (!/\bLISTEN\b/i.test(line) && !/\(LISTEN\)/i.test(line)) continue;
    /** Default `lsof`: COMMAND PID USER ... */
    const parts = line.split(/\s+/);
    const pidGuess = Number.parseInt(parts.length > 1 ? parts[1] : '', 10);
    if (Number.isFinite(pidGuess) && pidGuess > 0) pids.add(pidGuess);
  }
  if (pids.size > 0) return [...pids];

  /** Alternate form some tools use (`:8080`). */
  const alt = spawnText('lsof', ['-nP', `-i :${port}`], 15_000);
  for (const raw of alt.split(/\r?\n/)) {
    const line = raw.trim();
    if (
      line.length === 0 ||
      line.startsWith('COMMAND') ||
      !lineMentionsListenPort(line, port)
    )
      continue;
    if (!/\bLISTEN\b/i.test(line) && !/\(LISTEN\)/i.test(line)) continue;
    const parts = line.split(/\s+/);
    const pidGuess = Number.parseInt(parts.length > 1 ? parts[1] : '', 10);
    if (Number.isFinite(pidGuess) && pidGuess > 0) pids.add(pidGuess);
  }
  return [...pids];
}

function listListenPidsOnWindowsTcp(port: number): number[] {
  const out = spawnText(
    'netstat',
    ['-ano', '-p', 'tcp'],
    20_000,
  );

  const pids = new Set<number>();
  for (const raw of out.split(/\r?\n/)) {
    const line = raw.trim();
    if (!lineMentionsListenPort(line, port)) continue;
    if (!/\bLISTENING\b/i.test(line)) continue;
    const parts = line.split(/\s+/);
    const last = parts[parts.length - 1];
    const pid = Number.parseInt(last ?? '', 10);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }

  if (pids.size > 0) return [...pids];

  try {
    const ps = spawnText(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
      ],
      20_000,
    );
    for (const line of ps.split(/\r?\n/)) {
      const pid = Number.parseInt(line.trim(), 10);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
  } catch {
    /* optional */
  }

  return [...pids];
}

function terminatePid(pid: number, force: boolean): void {
  if (pid === process.pid) return;
  if (isWin) {
    const args = ['/PID', String(pid), '/T'];
    if (force) args.push('/F');
    try {
      execFileSync('taskkill', args, {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 20_000,
      });
    } catch {
      /* ESRCH / access */
    }
    return;
  }
  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    /* EPERM / ESRCH */
  }
}

export type KillLoopbackOccupiersResult = {
  attempted: boolean;
  pids: number[];
};

function useGentleKillFirst(): boolean {
  return (
    process.env.LIMSPLUS_LITE_GENTLE_PORT_FREE === '1' ||
    process.env.LIMSPLUS_LITE_GENTLE_PORT_FREE === 'true'
  );
}

/**
 * Stops processes listening on **`port`** so Lite can bind **127.0.0.1:&lt;port&gt;**.
 *
 * Default: **force** (**SIGKILL** / **`taskkill /F`**) for reliable free on macOS/Windows.
 * Opt-in soft kill: **`LIMSPLUS_LITE_GENTLE_PORT_FREE=1`** (SIGTERM first, then force).
 */
export async function killTcpListenersOnPort(
  port: number,
): Promise<KillLoopbackOccupiersResult> {
  const gentle = useGentleKillFirst();
  const initial = listListenPidsOnTcpPort(port).filter((p) => p !== process.pid);
  const unique = [...new Set(initial)];
  if (unique.length === 0) {
    return { attempted: false, pids: [] };
  }

  if (gentle) {
    for (const pid of unique) {
      try {
        terminatePid(pid, false);
      } catch {
        /* continue */
      }
    }
    await delay(700);
  }

  for (const pid of unique) {
    try {
      terminatePid(pid, true);
    } catch {
      /* ignore */
    }
  }

  await delay(gentle ? 500 : 900);

  let stubborn = listListenPidsOnTcpPort(port).filter((p) => p !== process.pid);
  if (stubborn.length > 0) {
    for (const pid of stubborn) {
      try {
        terminatePid(pid, true);
      } catch {
        /* ignore */
      }
    }
    await delay(500);
    stubborn = listListenPidsOnTcpPort(port).filter((p) => p !== process.pid);
    if (stubborn.length > 0) {
      console.warn(
        `[LimsPlus Lite] Port ${port} still has listener PID(s): ${stubborn.join(
          ', ',
        )} — run as admin or stop manually (e.g. system service).`,
      );
    }
  }

  return { attempted: true, pids: unique };
}
