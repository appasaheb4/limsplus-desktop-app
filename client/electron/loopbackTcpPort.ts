import * as net from 'net';

/**
 * Probe-only: bind TCP on loopback briefly, close, release.
 * Caller should bind again fast (narrow TOCTOU window for localhost).
 *
 * Used by **`exclusiveLoopbackTcpPort.ts`** for fixed ports (Mongo **27017**, Nest **8080**)
 * with optional occupier kill; **`0`** / **`auto`** in env → ephemeral listen.
 */
export function listenLoopbackProbe(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    const onErr = (err: NodeJS.ErrnoException): void => {
      srv.off('listening', onListen);
      srv.close(() => reject(err));
    };
    const onListen = (): void => {
      srv.off('error', onErr);
      const addr = srv.address();
      const resolved =
        typeof addr === 'object' && addr !== null ? addr.port : port;
      srv.close(() => resolve(resolved));
    };
    srv.once('error', onErr);
    srv.once('listening', onListen);
    srv.listen(port, '127.0.0.1');
  });
}
