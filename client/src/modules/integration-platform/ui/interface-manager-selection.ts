import type {
  FlowMode,
  InstrumentOption,
  LinkType,
  PlatformSettings,
  ProtocolId,
} from './integration-platform.types';

export interface InterfaceManagerRecord {
  lab?: string;
  department?: string;
  instType?: string;
  instId?: string;
  communicationProtocol?: string;
  connectionType?: string;
  connectionString?: unknown;
  timeoutSetting?: unknown;
  encodingSetting?: unknown;
  communicationMode?: string;
  companyCode?: string;
  environment?: string;
}

export function uniqueText(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort();
}

export function recordsForEnvironment(
  records: InterfaceManagerRecord[],
  environment: string,
): InterfaceManagerRecord[] {
  if (!environment) return [];
  return records.filter((record) => record.environment === environment);
}

export function labsFor(
  records: InterfaceManagerRecord[],
  environment: string,
): string[] {
  return uniqueText(recordsForEnvironment(records, environment).map((record) => record.lab));
}

export function departmentsFor(
  records: InterfaceManagerRecord[],
  environment: string,
  lab: string,
): string[] {
  if (!lab) return [];
  return uniqueText(
    recordsForEnvironment(records, environment)
      .filter((record) => record.lab === lab)
      .map((record) => record.department),
  );
}

export function instrumentsForSelection(
  records: InterfaceManagerRecord[],
  environment: string,
  lab: string,
  department: string,
): InstrumentOption[] {
  if (!lab || !department) return [];
  const seen = new Set<string>();
  const options: InstrumentOption[] = [];
  recordsForEnvironment(records, environment)
    .filter((record) => record.lab === lab && record.department === department && record.instId)
    .forEach((record) => {
      const id = String(record.instId);
      if (seen.has(id)) return;
      seen.add(id);
      options.push({
        lab,
        department,
        id,
        type: String(record.instType || ''),
      });
    });
  return options.sort((left, right) => left.id.localeCompare(right.id));
}

export function findInterfaceRecord(
  records: InterfaceManagerRecord[],
  settings: Pick<PlatformSettings, 'environment' | 'lab' | 'department' | 'instrumentId'>,
): InterfaceManagerRecord | undefined {
  if (!settings.environment || !settings.lab || !settings.department || !settings.instrumentId) {
    return undefined;
  }
  return records.find(
    (record) =>
      record.environment === settings.environment &&
      record.lab === settings.lab &&
      record.department === settings.department &&
      record.instId === settings.instrumentId,
  );
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function text(value: unknown, fallback = ''): string {
  if (value == null || value === '') return fallback;
  return String(value);
}

function mapProtocol(value: string): ProtocolId {
  const protocol = value.toLowerCase();
  if (protocol.includes('hl7')) return 'hl7';
  if (protocol.includes('kermit')) return 'kermit';
  if (protocol.includes('hex')) return 'hex';
  if (protocol.includes('file')) return 'file';
  if (protocol.includes('api') || protocol.includes('rest')) return 'api';
  return 'astm';
}

function mapLink(value: string): LinkType | undefined {
  const type = value.toLowerCase();
  if (type.includes('tcp')) return 'tcpip';
  if (
    type.includes('serial') ||
    type.includes('rs-232') ||
    type.includes('rs232') ||
    type.includes('com')
  ) {
    return 'rs232';
  }
  if (type.includes('file')) return 'file';
  if (type.includes('api')) return 'api';
  return undefined;
}

function mapFlow(value: string): FlowMode | undefined {
  const mode = value.toLowerCase();
  if (mode.includes('uni')) return 'uni';
  if (mode.includes('bi')) return 'bi';
  if (mode.includes('query')) return 'query';
  if (mode.includes('broadcast')) return 'broadcast';
  return undefined;
}

function clearedConnection(settings: PlatformSettings): PlatformSettings {
  return {
    ...settings,
    protocol: 'astm',
    linkType: 'tcpip',
    flow: 'bi',
    tcp: { ip: '', port: '', mask: '', gateway: '' },
    serial: { port: '', baud: '', dataBits: '', stopBits: '', parity: '', flow: '' },
    filePath: '',
    apiEndpoint: '',
    timeout: { connect: '', read: '', write: '', ack: '', reconnect: '', retry: '' },
    encoding: '',
    unicode: false,
    unicodeName: '',
  };
}

export function clearSelection(
  settings: PlatformSettings,
  next: Partial<Pick<PlatformSettings, 'environment' | 'lab' | 'department'>>,
): PlatformSettings {
  return {
    ...clearedConnection(settings),
    environment: next.environment ?? settings.environment,
    lab: next.lab ?? '',
    department: next.department ?? '',
    instrumentId: '',
    instrumentType: '',
    companyCode: settings.companyCode,
  };
}

export function applyInterfaceRecord(
  settings: PlatformSettings,
  record: InterfaceManagerRecord,
): PlatformSettings {
  const connection = asObject(record.connectionString);
  const timeout = asObject(record.timeoutSetting);
  const encoding = asObject(record.encodingSetting);
  const unicodeRaw = text(encoding.unicodeSupport).toLowerCase();
  const unicode =
    unicodeRaw !== '' && !['no', 'n', 'off', 'false', '0', 'select'].includes(unicodeRaw);

  return {
    ...settings,
    lab: text(record.lab, settings.lab),
    department: text(record.department, settings.department),
    instrumentId: text(record.instId, settings.instrumentId),
    instrumentType: text(record.instType),
    companyCode: text(record.companyCode, settings.companyCode),
    environment: text(record.environment, settings.environment),
    protocol: record.communicationProtocol
      ? mapProtocol(record.communicationProtocol)
      : settings.protocol,
    linkType: mapLink(text(record.connectionType)) ?? settings.linkType,
    flow: record.communicationMode
      ? mapFlow(record.communicationMode) ?? settings.flow
      : settings.flow,
    tcp: {
      ip: text(connection.ipAddress ?? connection.ip),
      port: text(connection.port ?? connection.portNo),
      mask: text(connection.subnetMask ?? connection.mask),
      gateway: text(connection.gateway),
    },
    serial: {
      port: text(connection.comPort),
      baud: text(connection.baudRate),
      dataBits: text(connection.dataBits),
      stopBits: text(connection.stopBits),
      parity: text(connection.parity),
      flow: text(connection.flowControl),
    },
    filePath: text(connection.filePath ?? connection.path),
    apiEndpoint: text(connection.apiEndpoint ?? connection.endpoint ?? connection.url),
    timeout: {
      connect: text(timeout.connectionTimeout),
      read: text(timeout.readTimeout),
      write: text(timeout.writeTimeout),
      ack: text(timeout.ackTimeout),
      reconnect: text(timeout.reconnectInterval),
      retry: text(timeout.retryCount),
    },
    encoding: text(encoding.characterEncoding),
    unicode,
    unicodeName: unicode ? text(encoding.unicodeSupport) : '',
  };
}
