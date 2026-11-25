import { segmentCount } from '../integration-platform.helpers';
import type { IntegrationPlatformModel } from '../use-integration-platform';
import { Icon } from './icon.component';
import { Pill } from './primitives.component';

export function ParsedMessage({
  model,
  detailed,
}: {
  model: IntegrationPlatformModel;
  detailed?: boolean;
}) {
  const frame = model.frame;
  const outside = frame.results.some((row) => row.flag !== 'Normal');
  if (!detailed) {
    return (
      <section className='ip-panel' key={frame.id}>
        <div className='ip-panel-head'>
          <h2 className='ip-panel-title'>Parsed ASTM E1394 message</h2>
          <button type='button' className='ip-btn ip-btn-ghost' onClick={model.copyParsed}>
            <Icon name='copy' size={14} /> Copy
          </button>
        </div>
        <table className='ip-table'>
          <thead>
            <tr><th>Segment</th><th>Field</th><th>Value</th></tr>
          </thead>
          <tbody>
            {frame.parsed.map((row) => (
              <tr key={`${row.field}-${row.name}`}>
                <td>{row.segmentLabel}</td>
                <td>{row.name}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className='ip-mini-stats' style={{ marginTop: 12 }}>
          <Mini label='Total segments' value={String(frame.records.length)} />
          <Mini label='Results (R)' value={String(segmentCount(frame, 'r'))} />
          <Mini label='Comments (C)' value='0' />
          <Mini label='Terminator (L)' value={String(segmentCount(frame, 'l'))} />
        </div>
      </section>
    );
  }

  return (
    <div className='ip-workspace is-parsed' key={frame.id}>
      <section className='ip-panel'>
        <div className='ip-sample'>
          <div>
            <span>Sample</span>
            <strong>{frame.order.specimenId}</strong>
          </div>
          <div>
            <span>{frame.order.panel} · {frame.order.reportType}</span>
          </div>
        </div>
        <div className='ip-mini-stats'>
          <Mini label='Total segments' value={String(frame.records.length)} />
          <Mini label='Results (R)' value={String(frame.results.length)} />
          <Mini label='Comments (C)' value='0' />
          <Mini label='Terminator (L)' value={String(segmentCount(frame, 'l'))} />
          <Mini label='Status' value={outside ? 'Review flags' : 'Ready to send'} ready={!outside} />
        </div>
        <div className='ip-panel-head'>
          <h2 className='ip-panel-title'>Results</h2>
          <button type='button' className='ip-btn' onClick={() => model.sendToLims(frame)}>
            <Icon name='send' size={14} /> Send to LIMS
          </button>
        </div>
        <table className='ip-table'>
          <thead>
            <tr>
              <th>Record</th><th>Test</th><th>Result</th><th>Unit</th>
              <th>Reference range</th><th>Flag</th><th>Measured at</th>
            </tr>
          </thead>
          <tbody>
            {frame.results.map((row) => (
              <tr key={row.record}>
                <td>{row.record}</td>
                <td className='ip-test'><b>{row.code}</b><small>{row.name}</small></td>
                <td><b>{row.result}</b></td>
                <td>{row.unit}</td>
                <td>{row.range}</td>
                <td><Pill tone={row.flag.toLowerCase()}>{row.flag}</Pill></td>
                <td>{row.measuredAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className='ip-order'>
          <Fact label='Specimen ID' value={frame.order.specimenId} />
          <Fact label='Test panel' value={frame.order.panel} />
          <Fact label='Report type' value={frame.order.reportType} />
          <Fact label='Instrument' value={frame.order.instrument} />
          <Fact label='Received at' value={frame.order.receivedAt} />
          <Fact label='Patient sex' value={frame.order.sex} />
          <Fact label='Frame' value={`${frame.number} of ${model.frames.length} · ${frame.bytes.length} bytes`} />
          <Fact label='Checksum' value={frame.checksumReceived.split(' ')[0] + (frame.status === 'Valid frame' ? ' · valid' : ' · check')} />
          <Fact label='Destination' value={frame.order.destination} />
        </div>
        <div className={outside ? 'ip-note is-warn' : 'ip-note'}>
          <Icon name={outside ? 'alert' : 'check'} size={16} />
          <span>{frame.note}</span>
        </div>
      </section>
      <section className='ip-panel'>
        <div className='ip-panel-head'>
          <h2 className='ip-panel-title'>Parsed ASTM E1394 message</h2>
          <button type='button' className='ip-btn ip-btn-ghost' onClick={model.copyParsed}>
            <Icon name='copy' size={14} /> Copy
          </button>
        </div>
        <table className='ip-table'>
          <thead>
            <tr><th>Segment</th><th>Field</th><th>Name</th><th>Value</th></tr>
          </thead>
          <tbody>
            {frame.parsed.map((row) => (
              <tr key={`${row.field}-${row.name}`}>
                <td><Pill tone={row.tone}>{row.segment}</Pill></td>
                <td>{row.field}</td>
                <td>{row.name}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Mini({ label, value, ready }: { label: string; value: string; ready?: boolean }) {
  return (
    <div className='ip-mini'>
      <span>{label}</span>
      <strong className={ready ? 'ready' : undefined}>{value}</strong>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
