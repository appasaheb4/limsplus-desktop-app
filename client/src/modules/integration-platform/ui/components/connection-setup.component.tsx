import type { ReactNode } from 'react';
import {
  BAUD_RATES,
  COM_PORTS,
  DATA_BITS,
  ENCODINGS,
  FLOW_CONTROL,
  FLOW_MODES,
  LINK_TYPES,
  PARITY,
  STOP_BITS,
} from '../integration-platform.mock';
import { cx } from '../integration-platform.helpers';
import type { IntegrationPlatformModel } from '../use-integration-platform';
import type { LinkType } from '../integration-platform.types';
import { Icon, type IconName } from './icon.component';
import { Field, SelectInput, TextInput, Toggle } from './primitives.component';

export function ConnectionSetup({
  model,
}: {
  model: IntegrationPlatformModel;
}) {
  const { settings } = model;
  const active = (type: LinkType) => settings.linkType === type;
  return (
    <div className='ip-setup'>
      <section className='ip-card'>
        <div className='ip-card-title'>
          <span className='ip-title-icon'>
            <Icon name='swap' size={16} />
          </span>
          <div>
            <h2>Connection settings</h2>
            <p>Link type and data flow</p>
          </div>
        </div>
        <div className='ip-field' style={{ marginTop: 14 }}>
          <span className='ip-label'>Connection type</span>
        </div>
        <div className='ip-choice-grid' style={{ marginTop: 8 }}>
          {LINK_TYPES.map((type) => (
            <button
              key={type.id}
              type='button'
              className={cx(
                'ip-choice',
                'ip-radio',
                active(type.id) && 'is-on',
              )}
              onClick={() => model.patch({ linkType: type.id })}
            >
              <Icon name={type.icon} size={15} />
              <b>{type.title}</b>
            </button>
          ))}
        </div>
        <div className='ip-field' style={{ marginTop: 14 }}>
          <span className='ip-label'>Communication mode</span>
        </div>
        <div className='ip-choice-grid' style={{ marginTop: 8 }}>
          {FLOW_MODES.map((mode) => (
            <button
              key={mode.id}
              type='button'
              className={cx(
                'ip-choice',
                'ip-radio',
                settings.flow === mode.id && 'is-on',
              )}
              onClick={() => model.patch({ flow: mode.id })}
            >
              <Icon name={mode.icon} size={15} />
              <b>{mode.title}</b>
            </button>
          ))}
        </div>
        <div>
          <div className='ip-field' style={{ marginTop: 14 }}>
            <span className='ip-label'>Upload log</span>
          </div>
          <div className='ip-upload'>
            <span className='ip-inline'>
              <Icon name='file' size={16} />
              <span>
                <b>{settings.logFileName || 'Choose .txt file'}</b>
                <small>Instrument log file</small>
              </span>
            </span>
            <label className='ip-btn'>
              Browse
              <input
                type='file'
                accept='.txt,.log'
                hidden
                disabled
                onChange={(event) => model.onLogFile(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      </section>

      <section className='ip-card'>
        <div className='ip-card-title'>
          <span className='ip-title-icon'>
            <Icon name='plug' size={16} />
          </span>
          <div>
            <h2>Instrument connection</h2>
            <p>Fill in the endpoint for the selected connection type</p>
          </div>
        </div>
        <Endpoint title='TCP/IP' icon='globe' active={active('tcpip')}>
          <div className='ip-form-grid cols-4'>
            <Field label='IP address'>
              <TextInput
                icon='globe'
                value={settings.tcp.ip}
                onChange={(ip) => model.patch({ tcp: { ...settings.tcp, ip } })}
              />
            </Field>
            <Field label='Port'>
              <TextInput
                value={settings.tcp.port}
                onChange={(port) =>
                  model.patch({ tcp: { ...settings.tcp, port } })
                }
              />
            </Field>
            <Field label='Subnet mask'>
              <TextInput
                icon='hash'
                value={settings.tcp.mask}
                onChange={(mask) =>
                  model.patch({ tcp: { ...settings.tcp, mask } })
                }
              />
            </Field>
            <Field label='Gateway'>
              <TextInput
                icon='swap'
                value={settings.tcp.gateway}
                onChange={(gateway) =>
                  model.patch({ tcp: { ...settings.tcp, gateway } })
                }
              />
            </Field>
          </div>
        </Endpoint>
        <Endpoint title='RS-232' icon='serial' active={active('rs232')}>
          <div className='ip-form-grid cols-6'>
            <Field label='COM port'>
              <SelectInput
                value={settings.serial.port}
                onChange={(port) =>
                  model.patch({ serial: { ...settings.serial, port } })
                }
                options={optionsWithCurrent(COM_PORTS, settings.serial.port)}
              />
            </Field>
            <Field label='Baud rate'>
              <SelectInput
                value={settings.serial.baud}
                onChange={(baud) =>
                  model.patch({ serial: { ...settings.serial, baud } })
                }
                options={optionsWithCurrent(BAUD_RATES, settings.serial.baud)}
              />
            </Field>
            <Field label='Data bits'>
              <SelectInput
                value={settings.serial.dataBits}
                onChange={(dataBits) =>
                  model.patch({ serial: { ...settings.serial, dataBits } })
                }
                options={optionsWithCurrent(
                  DATA_BITS,
                  settings.serial.dataBits,
                )}
              />
            </Field>
            <Field label='Stop bits'>
              <SelectInput
                value={settings.serial.stopBits}
                onChange={(stopBits) =>
                  model.patch({ serial: { ...settings.serial, stopBits } })
                }
                options={optionsWithCurrent(
                  STOP_BITS,
                  settings.serial.stopBits,
                )}
              />
            </Field>
            <Field label='Parity'>
              <SelectInput
                value={settings.serial.parity}
                onChange={(parity) =>
                  model.patch({ serial: { ...settings.serial, parity } })
                }
                options={optionsWithCurrent(PARITY, settings.serial.parity)}
              />
            </Field>
            <Field label='Flow control'>
              <SelectInput
                value={settings.serial.flow}
                onChange={(flow) =>
                  model.patch({ serial: { ...settings.serial, flow } })
                }
                options={optionsWithCurrent(FLOW_CONTROL, settings.serial.flow)}
              />
            </Field>
          </div>
        </Endpoint>
        <div className='ip-split-2 is-disabled'>
          <Endpoint title='File' icon='folder' active={active('file')}>
            <Field label='File path'>
              <TextInput
                icon='folder'
                value={settings.filePath}
                placeholder='Select file'
                onChange={(filePath) => model.patch({ filePath })}
              />
            </Field>
          </Endpoint>
          <Endpoint title='API' icon='braces' active={active('api')}>
            <Field label='API endpoint'>
              <TextInput
                icon='link'
                placeholder='Enter API endpoint'
                value={settings.apiEndpoint}
                onChange={(apiEndpoint) => model.patch({ apiEndpoint })}
              />
            </Field>
          </Endpoint>
        </div>
      </section>

      <section className='ip-card'>
        <div className='ip-card-title'>
          <span className='ip-title-icon'>
            <Icon name='clock' size={16} />
          </span>
          <div>
            <h2>Timeout and encoding settings</h2>
            <p>Fine-tune how the connection behaves</p>
          </div>
        </div>
        <div className='ip-block-head' style={{ marginTop: 14 }}>
          <span>
            <Icon name='clock' size={14} /> Timeout settings
          </span>
          <small className='ip-hint'>All values in seconds</small>
        </div>
        <div className='ip-form-grid cols-2'>
          <Field label='Connection timeout'>
            <TextInput
              icon='clock'
              value={settings.timeout.connect}
              suffix='sec'
              onChange={(connect) =>
                model.patch({ timeout: { ...settings.timeout, connect } })
              }
            />
          </Field>
          <Field label='Read timeout'>
            <TextInput
              icon='clock'
              value={settings.timeout.read}
              suffix='sec'
              onChange={(read) =>
                model.patch({ timeout: { ...settings.timeout, read } })
              }
            />
          </Field>
          <Field label='Write timeout'>
            <TextInput
              icon='clock'
              value={settings.timeout.write}
              suffix='sec'
              onChange={(write) =>
                model.patch({ timeout: { ...settings.timeout, write } })
              }
            />
          </Field>
          <Field label='ACK timeout'>
            <TextInput
              icon='clock'
              value={settings.timeout.ack}
              suffix='sec'
              onChange={(ack) =>
                model.patch({ timeout: { ...settings.timeout, ack } })
              }
            />
          </Field>
          <Field label='Reconnect interval'>
            <TextInput
              icon='reset'
              value={settings.timeout.reconnect}
              suffix='sec'
              onChange={(reconnect) =>
                model.patch({ timeout: { ...settings.timeout, reconnect } })
              }
            />
          </Field>
          <Field label='Retry count'>
            <TextInput
              icon='reset'
              value={settings.timeout.retry}
              suffix='times'
              onChange={(retry) =>
                model.patch({ timeout: { ...settings.timeout, retry } })
              }
            />
          </Field>
        </div>
        <div className='ip-block-head' style={{ marginTop: 16 }}>
          <span>
            <Icon name='type' size={14} /> Encoding settings
          </span>
        </div>
        <div className='ip-form-grid cols-2'>
          <Field label='Character encoding'>
            <SelectInput
              icon='type'
              value={settings.encoding}
              onChange={(encoding) => model.patch({ encoding })}
              options={optionsWithCurrent(ENCODINGS, settings.encoding)}
            />
          </Field>
          <Field label='Unicode support'>
            <div className='ip-control'>
              <Icon name='type' size={14} />
              <span>{settings.unicode ? settings.unicodeName : 'Off'}</span>
              <Toggle
                on={settings.unicode}
                label='Unicode support'
                onChange={(unicode) => model.patch({ unicode })}
              />
            </div>
          </Field>
        </div>
      </section>
    </div>
  );
}

function option(value: string) {
  return { value, label: value };
}

function optionsWithCurrent(values: string[], current: string) {
  const options = values.map(option);
  if (current && !values.includes(current)) {
    options.unshift({ value: current, label: current });
  }
  return options;
}

function Endpoint({
  title,
  icon,
  active,
  children,
}: {
  title: string;
  icon: IconName;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx('ip-block', active && 'is-active')}>
      <div className='ip-block-head'>
        <span>
          <Icon name={icon} size={14} /> {title}
        </span>
        <em className={cx('ip-badge', active && 'is-on')}>
          {active ? 'Active' : 'Inactive'}
        </em>
      </div>
      {children}
    </div>
  );
}
