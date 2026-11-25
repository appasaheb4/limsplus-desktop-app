import { PROTOCOLS } from '../integration-platform.mock';
import type { IntegrationPlatformModel } from '../use-integration-platform';
import { Icon, type IconName } from './icon.component';
import { Field, SelectInput, TextInput } from './primitives.component';
import { cx } from '../integration-platform.helpers';

export function InstrumentDetails({ model }: { model: IntegrationPlatformModel }) {
  const { settings } = model;
  return (
    <section className='ip-card'>
      <div className='ip-card-head'>
        <div className='ip-card-title'>
          <span className='ip-title-icon'>
            <Icon name='beaker' size={16} />
          </span>
          <div>
            <h2>Instrument details</h2>
            <p>Select the lab and instrument from master data</p>
          </div>
        </div>
        <div className='ip-mode-label'>
          Connection mode
          <div className='ip-segment' role='group' aria-label='Connection mode'>
            <button
              type='button'
              className={cx(settings.connectionMode === 'auto' && 'is-on')}
              onClick={() => model.patch({ connectionMode: 'auto' })}
            >
              <Icon name='connect' size={13} /> Auto
            </button>
            <button
              type='button'
              className={cx(settings.connectionMode === 'manual' && 'is-on')}
              onClick={() => {
                model.patch({ connectionMode: 'manual' });
                model.setSendMode('manual');
              }}
            >
              <Icon name='file' size={13} /> Manual
            </button>
          </div>
        </div>
      </div>

      <div className='ip-grid-6'>
        <Field label='Lab'>
          <SelectInput
            icon='building'
            value={settings.lab}
            onChange={model.setLab}
            options={withSelect(model.labs)}
          />
        </Field>
        <Field label='Department'>
          <SelectInput
            icon='beaker'
            value={settings.department}
            onChange={model.setDepartment}
            options={withSelect(model.departments)}
          />
        </Field>
        <Field label='Instrument ID'>
          <SelectInput
            icon='hash'
            value={settings.instrumentId}
            onChange={model.setInstrument}
            options={withSelect(model.instrumentOptions.map((item) => item.id))}
          />
        </Field>
        <Field label='Instrument type'>
          <TextInput icon='beaker' value={settings.instrumentType} readOnly />
        </Field>
        <Field label='Company code'>
          <TextInput icon='building' value={settings.companyCode} readOnly />
        </Field>
        <Field label='Environment'>
          <SelectInput
            icon='cloud'
            value={settings.environment}
            onChange={model.setEnvironment}
            options={withSelect(model.environments)}
          />
        </Field>
      </div>

      <div className='ip-field' style={{ marginTop: 12 }}>
        <span className='ip-label'>Communication protocol</span>
      </div>
      <div className='ip-protocol-row'>
        {PROTOCOLS.map((protocol) => (
          <ProtocolChoice
            key={protocol.id}
            icon={protocol.icon}
            title={protocol.title}
            detail={protocol.detail}
            active={settings.protocol === protocol.id}
            onClick={() => model.patch({ protocol: protocol.id })}
          />
        ))}
      </div>
    </section>
  );
}

function withSelect(values: string[]) {
  return [{ value: '', label: 'Select' }, ...values.map((value) => ({ value, label: value }))];
}

function ProtocolChoice({
  icon,
  title,
  detail,
  active,
  onClick,
}: {
  icon: IconName;
  title: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type='button' className={cx('ip-choice', active && 'is-on')} onClick={onClick}>
      <span className='ip-choice-icon'>
        <Icon name={icon} size={15} />
      </span>
      <span>
        <b>{title}</b>
        <small>{detail}</small>
      </span>
    </button>
  );
}
