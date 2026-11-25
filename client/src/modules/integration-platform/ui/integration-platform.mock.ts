import { bytesFromAstm } from './integration-platform.helpers';
import type {
  FrameModel,
  InstrumentOption,
  LogRecord,
  ParsedRow,
  PlatformSettings,
  ResultRow,
  SegmentTone,
  SessionStats,
} from './integration-platform.types';

export const INITIAL_SETTINGS: PlatformSettings = {
  connectionMode: 'auto',
  lab: '',
  department: '',
  instrumentId: '',
  instrumentType: '',
  companyCode: '',
  environment: '',
  protocol: 'astm',
  linkType: 'tcpip',
  flow: 'bi',
  logFileName: '',
  tcp: { ip: '', port: '', mask: '', gateway: '' },
  serial: {
    port: '',
    baud: '',
    dataBits: '',
    stopBits: '',
    parity: '',
    flow: '',
  },
  filePath: '',
  apiEndpoint: '',
  timeout: {
    connect: '',
    read: '',
    write: '',
    ack: '',
    reconnect: '',
    retry: '',
  },
  encoding: '',
  unicode: false,
  unicodeName: '',
};

export const INSTRUMENTS: InstrumentOption[] = [
  { lab: 'Main lab', department: 'Hematology', id: 'DEMO-SYSMEX-SN-350', type: 'SYSMEX-XN-350' },
  { lab: 'Main lab', department: 'Hematology', id: 'DEMO-SYSMEX-SN-550', type: 'SYSMEX-XN-550' },
  { lab: 'Main lab', department: 'Chemistry', id: 'DEMO-COBAS-C311', type: 'COBAS-C311' },
  { lab: 'Satellite lab', department: 'Hematology', id: 'SAT-SYSMEX-XN-350', type: 'SYSMEX-XN-350' },
  { lab: 'Satellite lab', department: 'Immunology', id: 'SAT-ARCHITECT-I1000', type: 'ARCHITECT-I1000' },
];

export const LABS = ['Main lab', 'Satellite lab'];
export const ENVIRONMENTS = ['Production', 'Staging', 'Training'];
export const ENCODINGS = ['ASCII', 'UTF-8', 'ISO-8859-1'];
export const COM_PORTS = ['COM1', 'COM2', 'COM3', 'COM4'];
export const BAUD_RATES = ['2400', '4800', '9600', '19200', '38400', '57600', '115200'];
export const DATA_BITS = ['7', '8'];
export const STOP_BITS = ['1', '2'];
export const PARITY = ['None', 'Even', 'Odd'];
export const FLOW_CONTROL = ['None', 'XON/XOFF', 'RTS/CTS'];
export const PAGE_SIZES = [10, 15, 25];

export const PROTOCOLS = [
  { id: 'astm' as const, title: 'ASTM', detail: 'E1381 / E1394', icon: 'swap' as const },
  { id: 'hl7' as const, title: 'HL7', detail: 'v2.x (MLLP)', icon: 'doc' as const },
  { id: 'kermit' as const, title: 'Kermit', detail: 'File transfer', icon: 'link' as const },
  { id: 'hex' as const, title: 'Hexadecimal', detail: 'Raw bytes', icon: 'hash' as const },
  { id: 'file' as const, title: 'File', detail: 'Folder watch', icon: 'folder' as const },
  { id: 'api' as const, title: 'API', detail: 'REST / web service', icon: 'braces' as const },
];

export const LINK_TYPES = [
  { id: 'tcpip' as const, title: 'TCP/IP', icon: 'globe' as const },
  { id: 'api' as const, title: 'API', icon: 'braces' as const },
  { id: 'rs232' as const, title: 'RS-232', icon: 'serial' as const },
  { id: 'file' as const, title: 'File', icon: 'folder' as const },
];

export const FLOW_MODES = [
  { id: 'uni' as const, title: 'Uni-directional', icon: 'arrowRight' as const },
  { id: 'bi' as const, title: 'Bi-directional', icon: 'swap' as const },
  { id: 'query' as const, title: 'Host query', icon: 'search' as const },
  { id: 'broadcast' as const, title: 'Broadcasting', icon: 'broadcast' as const },
];

export const SESSION_STATS: SessionStats = {
  received: 120,
  sent: 98,
  ack: 64,
  warnings: 3,
  errors: 0,
  lastActivity: '09:40:21',
};

const SEED: Array<Omit<LogRecord, 'id' | 'index'>> = [
  { at: '2025-05-15 09:30:15', time: '09:30:15', direction: 'out', kind: 'Connection', length: null, status: 'Success', message: 'Connection established with 192.168.1.50:8080.', details: 'TCP connected' },
  { at: '2025-05-15 09:30:16', time: '09:30:16', direction: 'out', kind: 'Handshake', length: null, status: 'Success', message: 'Handshake completed.', details: 'ENQ / ACK' },
  { at: '2025-05-15 09:30:17', time: '09:30:17', direction: 'in', kind: 'Status', length: 48, status: 'Success', message: 'Instrument status: Ready.', details: 'Status OK' },
  { at: '2025-05-15 09:31:02', time: '09:31:02', direction: 'in', kind: 'Data transfer', length: 244, status: 'Success', message: 'Sample 123456 results received (WBC, RBC, HGB).', details: 'Frame 1', frameId: 'frame-1' },
  { at: '2025-05-15 09:31:02', time: '09:31:02', direction: 'out', kind: 'ACK', length: null, status: 'Success', message: 'ACK sent to instrument.', details: 'ACK (06)' },
  { at: '2025-05-15 09:31:03', time: '09:31:03', direction: 'out', kind: 'Send to LIMS', length: null, status: 'Success', message: '3 results for sample 123456 sent to LIMSPLUS.', details: 'Auto' },
  { at: '2025-05-15 09:31:45', time: '09:31:45', direction: 'in', kind: 'Data transfer', length: 198, status: 'Warning', message: 'Partial results received (2 samples).', details: 'Frame 2', frameId: 'frame-2' },
  { at: '2025-05-15 09:31:45', time: '09:31:45', direction: 'out', kind: 'ACK', length: null, status: 'Success', message: 'ACK sent to instrument.', details: 'ACK (06)' },
  { at: '2025-05-15 09:32:10', time: '09:32:10', direction: 'in', kind: 'Status', length: 48, status: 'Success', message: 'Instrument status: Ready.', details: 'Status OK' },
  { at: '2025-05-15 09:36:10', time: '09:36:10', direction: 'in', kind: 'Data transfer', length: 210, status: 'Success', message: 'Sample 123458 results received.', details: 'Frame 3', frameId: 'frame-3' },
  { at: '2025-05-15 09:36:10', time: '09:36:10', direction: 'out', kind: 'ACK', length: null, status: 'Success', message: 'ACK sent to instrument.', details: 'ACK (06)' },
  { at: '2025-05-15 09:36:11', time: '09:36:11', direction: 'out', kind: 'Send to LIMS', length: null, status: 'Success', message: 'Results for sample 123458 sent to LIMSPLUS.', details: 'Auto' },
  { at: '2025-05-15 09:38:40', time: '09:38:40', direction: 'in', kind: 'Status', length: 48, status: 'Success', message: 'Instrument status: Ready.', details: 'Status OK' },
  { at: '2025-05-15 09:40:21', time: '09:40:21', direction: 'in', kind: 'Status', length: 48, status: 'Success', message: 'Instrument status: Ready.', details: 'Status OK' },
  { at: '2025-05-15 09:40:52', time: '09:40:52', direction: 'out', kind: 'Handshake', length: null, status: 'Success', message: 'Keep-alive check completed.', details: 'ENQ / ACK' },
];

const EXTRA_PATTERN: Array<Omit<LogRecord, 'id' | 'index' | 'at' | 'time'>> = [
  { direction: 'in', kind: 'Status', length: 48, status: 'Success', message: 'Instrument status: Ready.', details: 'Status OK' },
  { direction: 'out', kind: 'ACK', length: null, status: 'Success', message: 'ACK sent to instrument.', details: 'ACK (06)' },
  { direction: 'out', kind: 'Handshake', length: null, status: 'Success', message: 'Keep-alive check completed.', details: 'ENQ / ACK' },
  { direction: 'in', kind: 'Data transfer', length: 186, status: 'Success', message: 'Sample results received.', details: 'Frame 1', frameId: 'frame-1' },
  { direction: 'in', kind: 'Data transfer', length: 164, status: 'Warning', message: 'Partial results received (2 samples).', details: 'Frame 2', frameId: 'frame-2' },
];

function clock(index: number): { at: string; time: string } {
  const totalSeconds = 41 * 60 + index * 17;
  const hour = 9 + Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  const time = [hour, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  return { at: `2025-05-15 ${time}`, time };
}

function buildLogs(): LogRecord[] {
  const seed = SEED.map((row, index) => ({ ...row, id: `log-${index + 1}`, index: index + 1 }));
  const extra = Array.from({ length: 105 }, (_, offset) => {
    const index = seed.length + offset + 1;
    const pattern = EXTRA_PATTERN[offset % EXTRA_PATTERN.length];
    return { ...pattern, ...clock(offset), id: `log-${index}`, index };
  });
  return [...seed, ...extra];
}

export const MOCK_LOGS: LogRecord[] = buildLogs();

function row(
  tone: SegmentTone,
  segment: string,
  segmentLabel: string,
  field: string,
  name: string,
  value: string,
): ParsedRow {
  return { tone, segment, segmentLabel, field, name, value };
}

function result(
  record: string,
  code: string,
  name: string,
  value: string,
  unit: string,
  range: string,
  flag: ResultRow['flag'],
  measuredAt: string,
): ResultRow {
  return { record, code, name, result: value, unit, range, flag, measuredAt };
}

const FRAME_1_BODY = [
  '1H|\\^&|||SYSMEX^XN-350||||||||P|E1394-97',
  'P|1|||||||U',
  'O|1||^^123456^B|^^^^CBC|||||||N||||||||||||||F',
  'R|1|^^^^WBC^1|7.8|10^3/uL|4.0-11.0|N||||||20250515093102',
  'R|2|^^^^RBC^1|4.85|10^6/uL|4.20-5.80|N',
  'R|3|^^^^HGB^1|14.2|g/dL|13.0-17.0|N',
  'L|1|N',
].join('\n');

const FRAME_2_BODY = [
  '1H|\\^&|||SYSMEX^XN-350||||||||P|E1394-97',
  'P|1|||||||U',
  'O|1||^^123457^B|^^^^CBC|||||||N||||||||||||||F',
  'R|1|^^^^WBC^1|12.4|10^3/uL|4.0-11.0|H||||||20250515093145',
  'R|2|^^^^PLT^1|98|10^3/uL|150-450|L',
  'L|1|N',
].join('\n');

const FRAME_3_BODY = [
  '1H|\\^&|||SYSMEX^XN-350||||||||P|E1394-97',
  'P|1|||||||U',
  'O|1||^^123458^B|^^^^CBC|||||||N||||||||||||||F',
  'R|1|^^^^WBC^1|6.2|10^3/uL|4.0-11.0|N||||||20250515093610',
  'R|2|^^^^RBC^1|4.90|10^6/uL|4.20-5.80|N',
  'R|3|^^^^HGB^1|13.8|g/dL|13.0-17.0|N',
  'L|1|N',
].join('\n');

export const MOCK_FRAMES: FrameModel[] = [
  {
    id: 'frame-1',
    number: 1,
    at: '2025-05-15 09:31:02',
    time: '09:31:02',
    bytes: bytesFromAstm(FRAME_1_BODY, 'D2'),
    direction: 'Received (Instrument → LIMS)',
    frameType: 'Data transfer',
    status: 'Valid frame',
    checksumReceived: 'D2 (210)',
    checksumCalculated: 'D2 (210)',
    records: [
      { tone: 'h', label: 'H', raw: '1H|\\^&|||SYSMEX^XN-350||||||||P|E1394-97' },
      { tone: 'p', label: 'P', raw: 'P|1|||||||U' },
      { tone: 'o', label: 'O', raw: 'O|1||^^123456^B|^^^^CBC|||||||N||||||||||||||F' },
      { tone: 'r', label: 'R', raw: 'R|1|^^^^WBC^1|7.8|10^3/uL|4.0-11.0|N||||||20250515093102' },
      { tone: 'r', label: 'R', raw: 'R|2|^^^^RBC^1|4.85|10^6/uL|4.20-5.80|N' },
      { tone: 'r', label: 'R', raw: 'R|3|^^^^HGB^1|14.2|g/dL|13.0-17.0|N' },
      { tone: 'l', label: 'L', raw: 'L|1|N' },
    ],
    parsed: [
      row('h', 'H · Header', 'Header', 'H.2', 'Delimiters', '|\\^&'),
      row('h', 'H · Header', 'Header', 'H.5', 'Instrument ID', 'SYSMEX'),
      row('h', 'H · Header', 'Header', 'H.5.2', 'Model', 'XN-350'),
      row('h', 'H · Header', 'Header', 'H.12', 'Processing ID', 'P (Production)'),
      row('h', 'H · Header', 'Header', 'H.13', 'ASTM version', 'E1394-97'),
      row('p', 'P · Patient', 'Patient', 'P.2', 'Sequence no', '1'),
      row('p', 'P · Patient', 'Patient', 'P.10', 'Sex', 'U (Unknown)'),
      row('o', 'O · Order', 'Order', 'O.2', 'Sequence no', '1'),
      row('o', 'O · Order', 'Order', 'O.4', 'Specimen ID', '123456'),
      row('o', 'O · Order', 'Order', 'O.5', 'Test code', 'CBC'),
      row('o', 'O · Order', 'Order', 'O.12', 'Action code', 'N (New)'),
      row('o', 'O · Order', 'Order', 'O.26', 'Report type', 'F (Final)'),
      row('l', 'L · Terminator', 'Terminator', 'L.3', 'Termination code', 'N (Normal)'),
    ],
    results: [
      result('R.1', 'WBC', 'White blood cells', '7.8', '10^3/uL', '4.0 - 11.0', 'Normal', '2025-05-15 09:31:02'),
      result('R.2', 'RBC', 'Red blood cells', '4.85', '10^6/uL', '4.20 - 5.80', 'Normal', '2025-05-15 09:31:02'),
      result('R.3', 'HGB', 'Haemoglobin', '14.2', 'g/dL', '13.0 - 17.0', 'Normal', '2025-05-15 09:31:02'),
    ],
    order: {
      specimenId: '123456',
      panel: 'CBC',
      reportType: 'F (Final)',
      instrument: 'SYSMEX XN-350',
      receivedAt: '2025-05-15 09:31:02',
      sex: 'U (Unknown)',
      destination: 'LIMSPLUS result table',
    },
    note: 'All 3 results are within the reference range. They will be held here for review before going to the LIMSPLUS result table.',
  },
  {
    id: 'frame-2',
    number: 2,
    at: '2025-05-15 09:31:45',
    time: '09:31:45',
    bytes: bytesFromAstm(FRAME_2_BODY, 'A7'),
    direction: 'Received (Instrument → LIMS)',
    frameType: 'Data transfer',
    status: 'Partial frame',
    checksumReceived: 'A7 (167)',
    checksumCalculated: 'A7 (167)',
    records: [
      { tone: 'h', label: 'H', raw: '1H|\\^&|||SYSMEX^XN-350||||||||P|E1394-97' },
      { tone: 'p', label: 'P', raw: 'P|1|||||||U' },
      { tone: 'o', label: 'O', raw: 'O|1||^^123457^B|^^^^CBC|||||||N||||||||||||||F' },
      { tone: 'r', label: 'R', raw: 'R|1|^^^^WBC^1|12.4|10^3/uL|4.0-11.0|H||||||20250515093145' },
      { tone: 'r', label: 'R', raw: 'R|2|^^^^PLT^1|98|10^3/uL|150-450|L' },
      { tone: 'l', label: 'L', raw: 'L|1|N' },
    ],
    parsed: [
      row('h', 'H · Header', 'Header', 'H.5', 'Instrument ID', 'SYSMEX'),
      row('h', 'H · Header', 'Header', 'H.5.2', 'Model', 'XN-350'),
      row('p', 'P · Patient', 'Patient', 'P.10', 'Sex', 'U (Unknown)'),
      row('o', 'O · Order', 'Order', 'O.4', 'Specimen ID', '123457'),
      row('o', 'O · Order', 'Order', 'O.5', 'Test code', 'CBC'),
      row('o', 'O · Order', 'Order', 'O.26', 'Report type', 'F (Final)'),
      row('l', 'L · Terminator', 'Terminator', 'L.3', 'Termination code', 'N (Normal)'),
    ],
    results: [
      result('R.1', 'WBC', 'White blood cells', '12.4', '10^3/uL', '4.0 - 11.0', 'High', '2025-05-15 09:31:45'),
      result('R.2', 'PLT', 'Platelets', '98', '10^3/uL', '150 - 450', 'Low', '2025-05-15 09:31:45'),
    ],
    order: {
      specimenId: '123457',
      panel: 'CBC',
      reportType: 'F (Final)',
      instrument: 'SYSMEX XN-350',
      receivedAt: '2025-05-15 09:31:45',
      sex: 'U (Unknown)',
      destination: 'LIMSPLUS result table',
    },
    note: '2 results are outside the reference range. Review them before sending to the LIMSPLUS result table.',
  },
  {
    id: 'frame-3',
    number: 3,
    at: '2025-05-15 09:36:10',
    time: '09:36:10',
    bytes: bytesFromAstm(FRAME_3_BODY, 'C4'),
    direction: 'Received (Instrument → LIMS)',
    frameType: 'Data transfer',
    status: 'Valid frame',
    checksumReceived: 'C4 (196)',
    checksumCalculated: 'C4 (196)',
    records: [
      { tone: 'h', label: 'H', raw: '1H|\\^&|||SYSMEX^XN-350||||||||P|E1394-97' },
      { tone: 'p', label: 'P', raw: 'P|1|||||||U' },
      { tone: 'o', label: 'O', raw: 'O|1||^^123458^B|^^^^CBC|||||||N||||||||||||||F' },
      { tone: 'r', label: 'R', raw: 'R|1|^^^^WBC^1|6.2|10^3/uL|4.0-11.0|N||||||20250515093610' },
      { tone: 'r', label: 'R', raw: 'R|2|^^^^RBC^1|4.90|10^6/uL|4.20-5.80|N' },
      { tone: 'r', label: 'R', raw: 'R|3|^^^^HGB^1|13.8|g/dL|13.0-17.0|N' },
      { tone: 'l', label: 'L', raw: 'L|1|N' },
    ],
    parsed: [
      row('h', 'H · Header', 'Header', 'H.5', 'Instrument ID', 'SYSMEX'),
      row('h', 'H · Header', 'Header', 'H.5.2', 'Model', 'XN-350'),
      row('p', 'P · Patient', 'Patient', 'P.10', 'Sex', 'U (Unknown)'),
      row('o', 'O · Order', 'Order', 'O.4', 'Specimen ID', '123458'),
      row('o', 'O · Order', 'Order', 'O.5', 'Test code', 'CBC'),
      row('o', 'O · Order', 'Order', 'O.26', 'Report type', 'F (Final)'),
      row('l', 'L · Terminator', 'Terminator', 'L.3', 'Termination code', 'N (Normal)'),
    ],
    results: [
      result('R.1', 'WBC', 'White blood cells', '6.2', '10^3/uL', '4.0 - 11.0', 'Normal', '2025-05-15 09:36:10'),
      result('R.2', 'RBC', 'Red blood cells', '4.90', '10^6/uL', '4.20 - 5.80', 'Normal', '2025-05-15 09:36:10'),
      result('R.3', 'HGB', 'Haemoglobin', '13.8', 'g/dL', '13.0 - 17.0', 'Normal', '2025-05-15 09:36:10'),
    ],
    order: {
      specimenId: '123458',
      panel: 'CBC',
      reportType: 'F (Final)',
      instrument: 'SYSMEX XN-350',
      receivedAt: '2025-05-15 09:36:10',
      sex: 'U (Unknown)',
      destination: 'LIMSPLUS result table',
    },
    note: 'All 3 results are within the reference range. They will be held here for review before going to the LIMSPLUS result table.',
  },
];
