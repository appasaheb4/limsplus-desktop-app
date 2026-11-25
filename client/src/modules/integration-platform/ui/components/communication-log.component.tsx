import { PAGE_SIZES } from '../integration-platform.mock';
import { cx } from '../integration-platform.helpers';
import type { LogKind, LogRecord, LogStatus } from '../integration-platform.types';
import type { IntegrationPlatformModel } from '../use-integration-platform';
import { Icon } from './icon.component';
import { Pagination, Pill, SelectInput, TextInput } from './primitives.component';

const KINDS: LogKind[] = ['Connection', 'Handshake', 'Status', 'Data transfer', 'ACK', 'Send to LIMS'];
const STATUSES: LogStatus[] = ['Success', 'Warning', 'Error'];

const KIND_TONE: Record<LogKind, string> = {
  Connection: 'connection',
  Handshake: 'handshake',
  Status: 'status',
  'Data transfer': 'transfer',
  ACK: 'ack',
  'Send to LIMS': 'send',
};

export function CommunicationLog({
  model,
  compact,
}: {
  model: IntegrationPlatformModel;
  compact?: boolean;
}) {
  const { logs, query } = model;
  const frameLabel = model.frame ? `Showing frame ${model.frame.number} in the side panels` : '';
  return (
    <section className='ip-panel'>
      <div className='ip-panel-head'>
        <h2 className='ip-panel-title'>Communication log</h2>
        {compact ? <span className='ip-hint'>{frameLabel}</span> : null}
      </div>
      {compact ? null : (
        <div className='ip-filters'>
          <div style={{ minWidth: 180 }}>
            <TextInput
              icon='search'
              value={query.text}
              placeholder='Search messages'
              onChange={(text) => model.setQuery({ ...query, text })}
            />
          </div>
          <SelectInput
            value={query.direction}
            onChange={(direction) =>
              model.setQuery({ ...query, direction: direction as typeof query.direction })
            }
            options={[
              { value: 'all', label: 'All directions' },
              { value: 'in', label: 'In' },
              { value: 'out', label: 'Out' },
            ]}
          />
          <SelectInput
            value={query.kind}
            onChange={(kind) => model.setQuery({ ...query, kind: kind as typeof query.kind })}
            options={[{ value: 'all', label: 'All types' }, ...KINDS.map((kind) => ({ value: kind, label: kind }))]}
          />
          <SelectInput
            value={query.status}
            onChange={(status) => model.setQuery({ ...query, status: status as typeof query.status })}
            options={[{ value: 'all', label: 'All statuses' }, ...STATUSES.map((status) => ({ value: status, label: status }))]}
          />
        </div>
      )}
      <div className='ip-table-wrap'>
        <table className='ip-table'>
          <thead>
            <tr>
              {compact ? null : <th>#</th>}
              <th>Time</th>
              <th>Direction</th>
              <th>Type</th>
              <th>Length</th>
              <th>Status</th>
              <th>Message</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.items.length === 0 ? (
              <tr>
                <td colSpan={compact ? 7 : 8}>
                  <div className='ip-empty'>No messages in this view.</div>
                </td>
              </tr>
            ) : (
              logs.items.map((row) => (
                <LogRow
                  key={row.id}
                  row={row}
                  compact={compact}
                  selected={row.id === model.selectedLogId}
                  onSelect={() => model.selectLog(row)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={logs.page}
        pages={logs.pages}
        from={logs.from}
        to={logs.to}
        total={logs.total}
        pageSize={model.pageSize}
        pageSizes={PAGE_SIZES}
        onPage={model.setPage}
        onPageSize={(size) => {
          model.setPageSize(size);
          model.setPage(1);
        }}
      />
    </section>
  );
}

function LogRow({
  row,
  compact,
  selected,
  onSelect,
}: {
  row: LogRecord;
  compact?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr className={cx(selected && 'is-selected')} onClick={onSelect}>
      {compact ? null : <td>{row.index}</td>}
      <td>{compact ? row.time : row.at}</td>
      <td>
        <span className={cx('ip-dir', row.direction)}>
          <Icon name={row.direction === 'in' ? 'arrowLeft' : 'arrowRight'} size={12} />
          {row.direction === 'in' ? 'In' : 'Out'}
        </span>
      </td>
      <td><Pill tone={KIND_TONE[row.kind]}>{row.kind}</Pill></td>
      <td>{row.length ?? '—'}</td>
      <td><Pill tone={row.status.toLowerCase()}>{row.status}</Pill></td>
      <td className='ip-message'>{row.message}</td>
      <td>{row.details}</td>
    </tr>
  );
}
