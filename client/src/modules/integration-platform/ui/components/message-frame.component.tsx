import { cx, toHexRows } from '../integration-platform.helpers';
import type { FrameModel } from '../integration-platform.types';
import type { IntegrationPlatformModel } from '../use-integration-platform';
import { Icon } from './icon.component';
import { Pill } from './primitives.component';

export function MessageFrame({
  model,
  compact,
}: {
  model: IntegrationPlatformModel;
  compact?: boolean;
}) {
  const frame = model.frame;
  const rows = toHexRows(frame.bytes);
  return (
    <section className='ip-panel' key={frame.id}>
      {compact ? null : (
        <div className='ip-frame-chips'>
          {model.frames.map((item) => (
            <button
              key={item.id}
              type='button'
              className={cx('ip-frame-chip', item.id === frame.id && 'is-on')}
              onClick={() => model.setSelectedFrameId(item.id)}
            >
              <b>Frame {item.number}</b>
              <small>{item.time} · {item.bytes.length} bytes</small>
            </button>
          ))}
        </div>
      )}
      <div className='ip-panel-head'>
        <h2 className='ip-panel-title'>Raw message frame</h2>
        <div className='ip-panel-tools'>
          {compact ? null : (
            <span className='ip-inline'>
              <i className='ip-dot is-live' /> Control characters (STX, ETX, CR, LF)
            </span>
          )}
          <button type='button' className='ip-btn ip-btn-ghost' onClick={model.copyFrame}>
            <Icon name='copy' size={14} /> {compact ? 'Copy' : 'Copy hex'}
          </button>
          {compact ? null : (
            <button type='button' className='ip-btn ip-btn-ghost' onClick={model.downloadFrame}>
              <Icon name='download' size={14} /> Download .txt
            </button>
          )}
        </div>
      </div>
      {compact ? <CompactHex rows={rows.slice(0, 6)} /> : <HexTable rows={rows} />}
      <h3 className='ip-panel-title' style={{ marginTop: 14 }}>Frame information</h3>
      <FrameFacts frame={frame} total={model.frames.length} />
      {compact ? null : (
        <>
          <h3 className='ip-panel-title' style={{ marginTop: 14 }}>Records in this frame</h3>
          {frame.records.map((record) => (
            <div className='ip-record' key={`${record.label}-${record.raw}`}>
              <Pill tone={record.tone}>{record.label}</Pill>
              <span>{record.raw}</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function HexTable({ rows }: { rows: ReturnType<typeof toHexRows> }) {
  return (
    <div className='ip-table-wrap ip-hex'>
      <table className='ip-table ip-hex-table'>
        <thead>
          <tr>
            <th>Offset</th>
            <th>00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F</th>
            <th>ASCII</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.offset}>
              <td>{row.offset}</td>
              <td>
                {row.cells.map((cell, index) => (
                  <span key={`${row.offset}-${index}`} className={cell.kind}>
                    {cell.hex}{' '}
                  </span>
                ))}
              </td>
              <td>
                {row.ascii.split('').map((char, index) => (
                  <span key={`${row.offset}-a-${index}`} className={row.cells[index]?.kind}>
                    {char}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactHex({ rows }: { rows: ReturnType<typeof toHexRows> }) {
  return (
    <div className='ip-split-2 ip-hex'>
      <div>
        <Pill tone='h'>STX (02)</Pill>{' '}
        <Pill tone='o'>ETX (03)</Pill>{' '}
        <Pill tone='warning'>CR (0D)</Pill>{' '}
        <Pill tone='status'>LF (0A)</Pill>
      </div>
      <div>
        {rows.map((row) => (
          <div key={row.offset}>
            {row.cells.map((cell, index) => (
              <span key={index} className={cell.kind}>{cell.hex} </span>
            ))}
            <div>{row.ascii}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrameFacts({ frame, total }: { frame: FrameModel; total: number }) {
  const valid = frame.status === 'Valid frame';
  return (
    <dl className='ip-meta'>
      <div><dt>Direction</dt><dd>{frame.direction}</dd></div>
      <div><dt>Frame type</dt><dd>{frame.frameType}</dd></div>
      <div><dt>Frame number</dt><dd>{frame.number} of {total}</dd></div>
      <div><dt>Received at</dt><dd>{frame.at}</dd></div>
      <div><dt>Length</dt><dd>{frame.bytes.length} bytes</dd></div>
      <div><dt>Records</dt><dd>{frame.records.length}</dd></div>
      <div><dt>Checksum (received)</dt><dd>{frame.checksumReceived}</dd></div>
      <div><dt>Checksum (calculated)</dt><dd>{frame.checksumCalculated}</dd></div>
      <div>
        <dt>Status</dt>
        <dd className={valid ? 'ip-ok' : ''}>
          {valid ? <Icon name='check' size={14} /> : null}
          {frame.status}
        </dd>
      </div>
    </dl>
  );
}
