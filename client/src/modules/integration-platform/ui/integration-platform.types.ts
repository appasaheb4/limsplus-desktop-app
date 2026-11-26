export type ProtocolId = 'astm' | 'hl7' | 'kermit' | 'hex' | 'file' | 'api';
export type LinkType = 'tcpip' | 'api' | 'rs232' | 'file';
export type FlowMode = 'uni' | 'bi' | 'query' | 'broadcast';
export type RunMode = 'auto' | 'manual';
export type WorkspaceView = 'log' | 'frame' | 'parsed' | 'all';
export type Direction = 'in' | 'out';
export type LogKind =
  | 'Connection'
  | 'Handshake'
  | 'Status'
  | 'Data transfer'
  | 'ACK'
  | 'Send to LIMS';
export type LogStatus = 'Success' | 'Warning' | 'Error';
export type SegmentTone = 'h' | 'p' | 'o' | 'r' | 'l';
export type ResultFlag = 'Normal' | 'High' | 'Low';

export interface SelectOption {
  value: string;
  label: string;
}

export interface InstrumentOption {
  lab: string;
  department: string;
  id: string;
  type: string;
}

export interface InstrumentSlot {
  id: string;
  index: number;
  title: string;
  named: boolean;
  connected: boolean;
  saved: boolean;
  locked: boolean;
  settings: PlatformSettings;
}

export interface PlatformSettings {
  connectionMode: RunMode;
  lab: string;
  department: string;
  instrumentId: string;
  instrumentType: string;
  companyCode: string;
  environment: string;
  protocol: ProtocolId;
  linkType: LinkType;
  flow: FlowMode;
  logFileName: string;
  tcp: { ip: string; port: string; mask: string; gateway: string };
  serial: {
    port: string;
    baud: string;
    dataBits: string;
    stopBits: string;
    parity: string;
    flow: string;
  };
  filePath: string;
  apiEndpoint: string;
  timeout: {
    connect: string;
    read: string;
    write: string;
    ack: string;
    reconnect: string;
    retry: string;
  };
  encoding: string;
  unicode: boolean;
  unicodeName: string;
}

export interface LogRecord {
  id: string;
  index: number;
  at: string;
  time: string;
  direction: Direction;
  kind: LogKind;
  length: number | null;
  status: LogStatus;
  message: string;
  details: string;
  frameId?: string;
}

export interface HexCell {
  hex: string;
  kind: 'stx' | 'cr' | 'data';
}

export interface HexRow {
  offset: string;
  cells: HexCell[];
  ascii: string;
}

export interface ParsedRow {
  segment: string;
  segmentLabel: string;
  tone: SegmentTone;
  field: string;
  name: string;
  value: string;
}

export interface ResultRow {
  record: string;
  code: string;
  name: string;
  result: string;
  unit: string;
  range: string;
  flag: ResultFlag;
  measuredAt: string;
}

export interface FrameRecordLine {
  tone: SegmentTone;
  label: string;
  raw: string;
}

export interface FrameOrder {
  specimenId: string;
  panel: string;
  reportType: string;
  instrument: string;
  receivedAt: string;
  sex: string;
  destination: string;
}

export interface FrameModel {
  id: string;
  number: number;
  at: string;
  time: string;
  bytes: number[];
  direction: string;
  frameType: string;
  status: 'Valid frame' | 'Partial frame';
  checksumReceived: string;
  checksumCalculated: string;
  records: FrameRecordLine[];
  parsed: ParsedRow[];
  results: ResultRow[];
  order: FrameOrder;
  note: string;
}

export interface SessionStats {
  received: number;
  sent: number;
  ack: number;
  warnings: number;
  errors: number;
  lastActivity: string;
}

export interface LogQuery {
  text: string;
  direction: 'all' | Direction;
  kind: 'all' | LogKind;
  status: 'all' | LogStatus;
}
