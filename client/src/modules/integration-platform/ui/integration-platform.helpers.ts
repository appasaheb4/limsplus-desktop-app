import type {
  FrameModel,
  HexRow,
  InstrumentOption,
  LogQuery,
  LogRecord,
  PlatformSettings,
  SegmentTone,
} from './integration-platform.types';

export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(' ');
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), pages);
  const startIndex = (safePage - 1) * pageSize;
  const slice = items.slice(startIndex, startIndex + pageSize);
  return {
    page: safePage,
    pages,
    total,
    from: total === 0 ? 0 : startIndex + 1,
    to: startIndex + slice.length,
    items: slice,
  };
}

/** Page buttons with a single ellipsis gap, matching the prototype pager. */
export function pageWindow(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const window: Array<number | 'gap'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) window.push('gap');
  for (let value = start; value <= end; value += 1) window.push(value);
  if (end < pages - 1) window.push('gap');
  window.push(pages);
  return window;
}

export function filterLogs(logs: LogRecord[], query: LogQuery): LogRecord[] {
  const text = query.text.trim().toLowerCase();
  return logs.filter((row) => {
    if (query.direction !== 'all' && row.direction !== query.direction) return false;
    if (query.kind !== 'all' && row.kind !== query.kind) return false;
    if (query.status !== 'all' && row.status !== query.status) return false;
    if (!text) return true;
    return `${row.message} ${row.details} ${row.kind} ${row.at}`
      .toLowerCase()
      .includes(text);
  });
}

export function listeningLine(settings: PlatformSettings, protocol: string, flow: string): string {
  if (settings.linkType === 'rs232') {
    return `${settings.serial.port} · ${settings.serial.baud} · ${protocol} · ${flow}`;
  }
  if (settings.linkType === 'file') {
    return `${settings.filePath} · ${protocol} · ${flow}`;
  }
  if (settings.linkType === 'api') {
    return `REST · ${protocol} · ${flow}`;
  }
  return `${settings.tcp.ip} : ${settings.tcp.port} · ${protocol} · ${flow}`;
}

export function instrumentsFor(
  catalog: InstrumentOption[],
  lab: string,
  department: string,
): InstrumentOption[] {
  return catalog.filter((item) => item.lab === lab && item.department === department);
}

export function uniqueValues(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

const CONTROL_KIND: Record<number, HexRow['cells'][number]['kind']> = {
  0x02: 'stx',
  0x03: 'stx',
  0x0d: 'cr',
  0x0a: 'cr',
};

export function toHexRows(bytes: number[]): HexRow[] {
  const rows: HexRow[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const slice = bytes.slice(offset, offset + 16);
    rows.push({
      offset: offset.toString(16).padStart(4, '0').toUpperCase(),
      cells: slice.map((byte) => ({
        hex: byte.toString(16).padStart(2, '0').toUpperCase(),
        kind: CONTROL_KIND[byte] ?? 'data',
      })),
      ascii: slice
        .map((byte) => (byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '·'))
        .join(''),
    });
  }
  return rows;
}

/** STX + ASTM records + ETX + checksum + CR LF. */
export function bytesFromAstm(body: string, checksum = 'D2'): number[] {
  const records = body.replace(/\n/g, '\r').replace(/\r+$/, '');
  return [
    0x02,
    ...Array.from(`${records}\r`, (char) => char.charCodeAt(0)),
    0x03,
    ...Array.from(checksum, (char) => char.charCodeAt(0)),
    0x0d,
    0x0a,
  ];
}

export function frameText(frame: FrameModel): string {
  return frame.records.map((record) => record.raw).join('\n');
}

export function logsToCsv(logs: LogRecord[]): string {
  const header = ['#', 'Time', 'Direction', 'Type', 'Length', 'Status', 'Message', 'Details'];
  const lines = logs.map((row) =>
    [
      row.index,
      row.at,
      row.direction,
      row.kind,
      row.length ?? '',
      row.status,
      row.message,
      row.details,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function downloadText(filename: string, contents: string, type = 'text/plain'): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function segmentCount(frame: FrameModel, tone: SegmentTone): number {
  return frame.records.filter((record) => record.tone === tone).length;
}

export function fileStem(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
