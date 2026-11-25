import { useEffect, useRef, type ReactNode } from 'react';
import { pageWindow } from '../integration-platform.helpers';
import { cx } from '../integration-platform.helpers';
import { Icon, type IconName } from './icon.component';

export function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <label className='ip-field'>
      <span className='ip-label'>
        {icon ? <Icon name={icon} size={12} /> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  icon,
  readOnly,
  placeholder,
  suffix,
}: {
  value: string;
  onChange?: (value: string) => void;
  icon?: IconName;
  readOnly?: boolean;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className='ip-control'>
      {icon ? <Icon name={icon} size={14} /> : null}
      <input
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {suffix ? <span className='ip-suffix'>{suffix}</span> : null}
    </div>
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  icon?: IconName;
}) {
  return (
    <div className='ip-control'>
      {icon ? <Icon name={icon} size={14} /> : null}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className='ip-chevron'>
        <Icon name='chevron' size={14} />
      </span>
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <button
      type='button'
      className={cx('ip-toggle', on && 'is-on')}
      aria-pressed={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: string;
  children: ReactNode;
}) {
  return <span className={cx('ip-pill', tone)}>{children}</span>;
}

export function Menu({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  if (!open) return null;
  return <div className='ip-menu'>{children}</div>;
}

export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

export function Pagination({
  page,
  pages,
  from,
  to,
  total,
  pageSize,
  pageSizes,
  onPage,
  onPageSize,
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  pageSize: number;
  pageSizes: number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const buttons = pageWindow(page, pages);
  return (
    <div className='ip-pager'>
      <span>
        Showing {from} to {to} of {total} records
      </span>
      <div className='ip-pager-pages'>
        <button type='button' className='ip-page-btn' onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label='Previous page'>
          ‹
        </button>
        {buttons.map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`}>…</span>
          ) : (
            <button
              key={item}
              type='button'
              className={cx('ip-page-btn', item === page && 'is-on')}
              onClick={() => onPage(item)}
            >
              {item}
            </button>
          ),
        )}
        <button type='button' className='ip-page-btn' onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label='Next page'>
          ›
        </button>
        <div className='ip-page-size'>
          <SelectInput
            value={String(pageSize)}
            onChange={(value) => onPageSize(Number(value))}
            options={pageSizes.map((size) => ({ value: String(size), label: `${size} / page` }))}
          />
        </div>
      </div>
    </div>
  );
}
