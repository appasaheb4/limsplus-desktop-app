import type {
  InstrumentLogBlockSummary,
  InstrumentLogResultRow,
  ParsedInstrumentLog,
} from '../helper/parseInstrumentLogFile';

const TABLE_CELL =
  'border-b border-white/10 px-4 py-3 text-sm text-gray-200';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  parsed: ParsedInstrumentLog | null;
};

function flagBadgeClass(flag: string): string {
  const f = flag.trim().toUpperCase();
  if (f === 'L' || f === 'H') return 'bg-amber-900/40 text-amber-200';
  if (f === 'N') return 'bg-emerald-900/40 text-emerald-200';
  if (f === 'A') return 'bg-white/10 text-gray-400';
  return 'bg-white/5 text-gray-300';
}

function BlockSummaryTable({ blocks }: { blocks: InstrumentLogBlockSummary[] }) {
  return (
    <div className='overflow-x-auto rounded-lg border border-white/10'>
      <table className='w-full min-w-[640px] border-collapse text-left'>
        <thead className='bg-[#242424] text-xs uppercase tracking-wide text-gray-500'>
          <tr>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Block</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Instrument</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Patient</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Sample</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium text-right'>
              Results
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-white/5 bg-black/20'>
          {blocks.map((block) => (
            <tr key={block.blockIndex}>
              <td className={TABLE_CELL}>#{block.blockIndex}</td>
              <td className={TABLE_CELL}>{block.instrument || '—'}</td>
              <td className={TABLE_CELL}>{block.patientId || '—'}</td>
              <td className={TABLE_CELL}>{block.sampleId || '—'}</td>
              <td className={`${TABLE_CELL} text-right tabular-nums`}>
                {block.resultCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultsTable({ results }: { results: InstrumentLogResultRow[] }) {
  if (results.length === 0) {
    return (
      <p className='rounded-lg border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-gray-500'>
        No R (result) segments found in this file.
      </p>
    );
  }

  return (
    <div className='max-h-[min(52vh,480px)] overflow-auto rounded-lg border border-white/10'>
      <table className='w-full min-w-[720px] border-collapse text-left'>
        <thead className='sticky top-0 z-10 bg-[#242424] text-xs uppercase tracking-wide text-gray-500'>
          <tr>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Block</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Seq</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Test</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Value</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Unit</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Flag</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-white/5 bg-black/20'>
          {results.map((row, idx) => (
            <tr key={`${row.blockIndex}-${row.sequence}-${row.test}-${idx}`}>
              <td className={`${TABLE_CELL} tabular-nums text-gray-400`}>
                #{row.blockIndex}
              </td>
              <td className={`${TABLE_CELL} tabular-nums`}>{row.sequence}</td>
              <td className={`${TABLE_CELL} font-medium text-white`}>{row.test}</td>
              <td className={`${TABLE_CELL} font-mono text-[#80deea]`}>{row.value}</td>
              <td className={TABLE_CELL}>{row.unit || '—'}</td>
              <td className={TABLE_CELL}>
                {row.flag ? (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${flagBadgeClass(row.flag)}`}
                  >
                    {row.flag}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InstrumentLogPreviewModal({
  isOpen,
  onClose,
  parsed,
}: Props) {
  if (!isOpen || !parsed) return null;

  return (
    <div
      className='fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
      role='dialog'
      aria-modal='true'
      aria-labelledby='instrument-log-preview-title'
      onClick={onClose}
    >
      <div
        className='flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-white/10 bg-[#1e1e1e] shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='border-b border-white/10 px-5 py-4 sm:px-6'>
          <h2
            id='instrument-log-preview-title'
            className='text-lg font-semibold text-white'
          >
            Instrument log preview
          </h2>
          <p className='mt-1 text-sm text-gray-500'>
            {parsed.fileName} — {parsed.blockCount} message block
            {parsed.blockCount === 1 ? '' : 's'},{' '}
            {parsed.results.length} result row
            {parsed.results.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className='flex-1 space-y-6 overflow-y-auto px-5 py-4 sm:px-6'>
          {parsed.parseError ? (
            <p
              className='rounded-lg border border-rose-800/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100'
              role='alert'
            >
              {parsed.parseError}
            </p>
          ) : (
            <>
              <div>
                <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-[#00bcd4]'>
                  Message blocks
                </h3>
                <BlockSummaryTable blocks={parsed.blocks} />
              </div>
              <div>
                <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-[#00bcd4]'>
                  Parsed results (R segments)
                </h3>
                <ResultsTable results={parsed.results} />
              </div>
            </>
          )}
        </div>

        <div className='flex justify-end border-t border-white/10 px-5 py-4 sm:px-6'>
          <button
            type='button'
            className='rounded-lg border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15'
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
