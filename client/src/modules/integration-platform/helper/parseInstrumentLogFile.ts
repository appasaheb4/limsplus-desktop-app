import { Parser } from './lib';

/** Default ASTM delimiters for instrument log files (e.g. Sysmex XN). */
export const DEFAULT_ASTM_INTERFACE_MANAGER = {
  instrumentType: 'ASTM',
  blockStart: '',
  blockEnd: '',
  fileds: [
    { filed: 'FIELD_DELIMITER', value: '|' },
    { filed: 'COMPONENT_DELIMITER', value: '^' },
    { filed: 'REPEAT_DELIMITER', value: '\\' },
    { filed: 'ESCAPE_DELIMITER', value: '&' },
    { filed: 'SUB_COMPONENT_DELIMITER', value: '&' },
    { filed: 'NEW_LINE', value: '\n' },
  ],
};

export type InstrumentLogResultRow = {
  blockIndex: number;
  sequence: string;
  test: string;
  value: string;
  unit: string;
  flag: string;
  rawSegment: string;
};

export type InstrumentLogBlockSummary = {
  blockIndex: number;
  instrument: string;
  patientId: string;
  sampleId: string;
  resultCount: number;
};

export type ParsedInstrumentLog = {
  fileName: string;
  blockCount: number;
  blocks: InstrumentLogBlockSummary[];
  results: InstrumentLogResultRow[];
  parseError?: string;
};

/** ASTM lines often prefix a frame digit (0–7) before the segment id, e.g. `6R|1|…`. */
function stripAstmFramePrefix(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length >= 2 && /^[0-7][A-Za-z0-9]/.test(trimmed)) {
    return trimmed.slice(1);
  }
  return trimmed;
}

/** Split uploaded log into ASTM message bodies (between `05` … `04` envelopes). */
export function extractAstmMessageBlocks(raw: string): string[] {
  const blocks: string[] = [];
  const envelopeRe = /05\r?\n([\s\S]*?)\r?\n04/g;
  let match: RegExpExecArray | null;
  while ((match = envelopeRe.exec(raw)) !== null) {
    const body = match[1].trim();
    if (!body) continue;
    const lines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const normalized = lines.map(stripAstmFramePrefix).join('\n');
    if (normalized.replace(/\s/g, '').length > 0) {
      blocks.push(normalized);
    }
  }

  if (blocks.length === 0 && raw.trim()) {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line !== '%' && line !== '05' && line !== '04');
    const normalized = lines.map(stripAstmFramePrefix).join('\n');
    if (normalized) blocks.push(normalized);
  }
  return blocks;
}

function extractComponentName(raw: string): string {
  if (!raw) return '';
  const parts = raw.split('^').filter((p) => p && p !== '1');
  return parts[parts.length - 1] || raw;
}

function parseBlockSummary(
  segments: Array<{ fields: string; values: string[] }>,
  blockIndex: number,
): InstrumentLogBlockSummary {
  let instrument = '';
  let patientId = '';
  let sampleId = '';
  let resultCount = 0;

  for (const seg of segments) {
    const type = (seg.fields || '').toUpperCase();
    if (type === 'H' && !instrument) {
      instrument =
        (seg.values[5] || seg.values[4] || seg.values[3] || '').trim() || '—';
    }
    if (type === 'P' && !patientId) {
      patientId = (seg.values[3] || seg.values[2] || '').trim() || '—';
    }
    if (type === 'O' && !sampleId) {
      const sampleField = (seg.values[3] || seg.values[2] || '').trim();
      const parts = sampleField.split('^').map((p) => p.trim()).filter(Boolean);
      sampleId = parts[parts.length - 1] || sampleField || '—';
    }
    if (type === 'R') {
      resultCount += 1;
    }
  }

  return { blockIndex, instrument, patientId, sampleId, resultCount };
}

function parseResultRows(
  segments: Array<{ fields: string; values: string[] }>,
  blockIndex: number,
): InstrumentLogResultRow[] {
  const rows: InstrumentLogResultRow[] = [];
  for (const seg of segments) {
    if ((seg.fields || '').toUpperCase() !== 'R') continue;
    const testRaw = seg.values[2] ?? '';
    rows.push({
      blockIndex,
      sequence: seg.values[1] ?? '',
      test: extractComponentName(testRaw),
      value: seg.values[3] ?? '',
      unit: seg.values[4] ?? '',
      flag: seg.values[6] ?? seg.values[7] ?? '',
      rawSegment: seg.values.join('|'),
    });
  }
  return rows;
}

export function parseInstrumentLogFile(
  rawText: string,
  fileName: string,
  interfaceManager: Record<string, unknown> = DEFAULT_ASTM_INTERFACE_MANAGER,
): ParsedInstrumentLog {
  const messageBlocks = extractAstmMessageBlocks(rawText);
  const parser = new Parser(interfaceManager);
  const blocks: InstrumentLogBlockSummary[] = [];
  const results: InstrumentLogResultRow[] = [];

  messageBlocks.forEach((blockText, index) => {
    const blockIndex = index + 1;
    const parsed = parser.parseString(blockText);
    if (!parsed || !Array.isArray(parsed)) return;
    blocks.push(parseBlockSummary(parsed, blockIndex));
    results.push(...parseResultRows(parsed, blockIndex));
  });

  if (blocks.length === 0) {
    return {
      fileName,
      blockCount: 0,
      blocks: [],
      results: [],
      parseError:
        'No ASTM message blocks found. Expected .txt with segments like H|, P|, O|, R| (Sysmex / ASTM format).',
    };
  }

  return {
    fileName,
    blockCount: blocks.length,
    blocks,
    results,
  };
}
