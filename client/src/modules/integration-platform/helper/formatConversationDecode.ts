export type ConversationDecodedField = {
  fieldName: string;
  value: string;
  fieldNo: number;
};

export type ConversationDecodedSegment = {
  blockIndex: number;
  segmentIndex: number;
  segment: string;
  fields: ConversationDecodedField[];
};

export type ConversationDecodePreview = {
  fileName: string;
  blockCount: number;
  segments: ConversationDecodedSegment[];
  parseError?: string;
};

type RawDecodeField = {
  filed?: string;
  field?: string;
  value?: unknown;
  field_no?: number;
};

export function dedupeDecodeFields(
  fields: RawDecodeField[],
): ConversationDecodedField[] {
  const seen = new Map<string, ConversationDecodedField>();

  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    const fieldNo = Number(field.field_no ?? 0);
    const fieldName = String(field.filed ?? field.field ?? '').trim();
    if (!fieldName) continue;
    const value = field.value != null ? String(field.value).trim() : '';
    const key = `${fieldNo}:${fieldName}`;
    const existing = seen.get(key);
    if (!existing || (value && !existing.value)) {
      seen.set(key, { fieldName, value, fieldNo });
    }
  }

  return [...seen.values()].sort((a, b) => a.fieldNo - b.fieldNo);
}

export function formatConversationDecodeResult(
  decodeResult: unknown,
  blockIndex: number,
): ConversationDecodedSegment[] {
  if (!Array.isArray(decodeResult)) return [];

  const segments: ConversationDecodedSegment[] = [];

  decodeResult.forEach((item, index) => {
    if (!Array.isArray(item) || item.length < 2) return;

    const segmentPart = item[0];
    const segment = Array.isArray(segmentPart)
      ? String(segmentPart[0] ?? '')
      : String(segmentPart ?? '');
    const rawFields = item[1];
    if (!Array.isArray(rawFields)) return;

    segments.push({
      blockIndex,
      segmentIndex: index + 1,
      segment: segment.toUpperCase(),
      fields: dedupeDecodeFields(rawFields as RawDecodeField[]),
    });
  });

  return segments;
}

/** Join log block lines using the instrument's configured NEW_LINE delimiter. */
export function buildConversationMessage(
  blockText: string,
  interfaceManager: Record<string, unknown>,
): string {
  const fileds = interfaceManager?.fileds as
    | Array<{ filed: string; value: string }>
    | undefined;
  const nlRaw = fileds?.find((f) => f.filed === 'NEW_LINE')?.value;
  const newline = resolveNewLineSeparator(nlRaw);
  const lines = blockText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let body = lines.join(newline);
  const instrumentType = String(interfaceManager?.instrumentType ?? '');

  if (instrumentType === 'SYSMEX XP-100' && body && !/^h/i.test(body)) {
    const firstPipe = body.indexOf('|');
    if (firstPipe > 0) {
      body = `h|${body.slice(firstPipe + 1)}`;
    }
  }

  const blockStart = resolveBlockDelimiter(
    interfaceManager?.blockStart as string | undefined,
  );
  const blockEnd = resolveBlockDelimiter(
    interfaceManager?.blockEnd as string | undefined,
  );

  if (blockStart || blockEnd) {
    return `${blockStart}${body}${blockEnd}`;
  }

  if (instrumentType === 'ASTM' || instrumentType.includes('SYSMEX')) {
    return `\x05${body}\x04`;
  }

  return body;
}

function resolveNewLineSeparator(raw: string | undefined): string {
  if (!raw) return '\n';
  if (raw.includes('<CR>') || raw.includes('<LF>') || raw.includes('<ETX>')) {
    return raw;
  }
  return resolveBlockDelimiter(raw);
}

function resolveBlockDelimiter(raw: string | undefined): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<CR>/gi, '\r')
    .replace(/<LF>/gi, '\n')
    .replace(/<ETX>/gi, '\x03')
    .replace(/\\n/g, '\n');
}
