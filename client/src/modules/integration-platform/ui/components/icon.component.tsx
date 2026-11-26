import type { SVGProps } from 'react';

export type IconName =
  | 'beaker'
  | 'swap'
  | 'doc'
  | 'link'
  | 'hash'
  | 'folder'
  | 'braces'
  | 'globe'
  | 'serial'
  | 'arrowRight'
  | 'arrowLeft'
  | 'search'
  | 'broadcast'
  | 'clock'
  | 'type'
  | 'reset'
  | 'save'
  | 'connect'
  | 'plug'
  | 'download'
  | 'copy'
  | 'send'
  | 'trash'
  | 'export'
  | 'gear'
  | 'chevron'
  | 'check'
  | 'building'
  | 'cloud'
  | 'list'
  | 'frame'
  | 'parsed'
  | 'grid'
  | 'file'
  | 'alert'
  | 'plus'
  | 'lock'
  | 'unlock';

const PATHS: Record<IconName, string> = {
  beaker: 'M9 3h6M10 3v5L5.5 18A3 3 0 0 0 8.2 22h7.6a3 3 0 0 0 2.7-4L14 8V3',
  swap: 'M7 7h11l-3-3M17 17H6l3 3',
  doc: 'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v6h6',
  link: 'M10 13a5 5 0 0 0 7.1.1l1.4-1.5a5 5 0 0 0-7.1-7.1L10.2 5.7M14 11a5 5 0 0 0-7.1-.1L5.5 12.4a5 5 0 0 0 7.1 7.1l1.2-1.2',
  hash: 'M5 9h14M5 15h14M9 4 7 20M17 4l-2 16',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  braces: 'M9 4c-2 1-3 2-3 8s1 7 3 8M15 4c2 1 3 2 3 8s-1 7-3 8',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z',
  serial: 'M4 8h16v8H4zM8 8V6M12 8V6M16 8V6M8 16v2M12 16v2M16 16v2',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  broadcast: 'M5 9a7 7 0 0 1 0 6M19 9a7 7 0 0 0 0 6M8.5 10.5a3.5 3.5 0 0 1 0 3M15.5 10.5a3.5 3.5 0 0 0 0 3M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v6l4 2',
  type: 'M5 6h14M12 6v12M8 18h8',
  reset: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5',
  save: 'M6 4h10l4 4v12H6V4zM8 4v5h8M9 20v-6h6v6',
  connect: 'M8 12h8M13 8l4 4-4 4',
  plug: 'M8 8V4M16 8V4M7 8h10v4a5 5 0 0 1-10 0V8zM12 17v3',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  copy: 'M8 8h10v12H8zM6 16H5a1 1 0 0 1-1-1V4h11v2',
  send: 'M4 12h10M11 7l5 5-5 5M19 6v12',
  trash: 'M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13',
  export: 'M12 16V4M7 8l5-5 5 5M5 20h14',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3v2M12 19v2M4.9 6.5l1.7 1M17.4 16.5l1.7 1M3 12h2M19 12h2M4.9 17.5l1.7-1M17.4 7.5l1.7-1',
  chevron: 'M6 9l6 6 6-6',
  check: 'M5 12.5 9.5 17 19 7',
  building: 'M4 20h16M6 20V5h8v15M14 9h4v11M9 8h2M9 12h2M9 16h2',
  cloud: 'M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  frame: 'M4 7h16v10H4zM8 7V5M16 7V5M8 19v-2M16 19v-2',
  parsed: 'M8 6h12M8 12h12M8 18h8M4 6l1.2 1.2L7 5.5M4 12l1.2 1.2L7 11.5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  file: 'M7 3h7l5 5v13H7V3zM14 3v6h6',
  alert: 'M12 9v4M12 17h.01M10.3 4.8 2.8 18a2 2 0 0 0 1.7 3h14.9a2 2 0 0 0 1.8-3L13.7 4.8a2 2 0 0 0-3.4 0z',
  plus: 'M12 5v14M5 12h14',
  lock: 'M8 11V8a4 4 0 0 1 8 0v3M6 11h12v9H6z',
  unlock: 'M8 11V8a4 4 0 0 1 7.4-2M6 11h12v9H6z',
};

export function Icon({
  name,
  size = 16,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function IconSvg(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props} />;
}
