import type { ConversationDecodePreview } from '../helper/formatConversationDecode';

const TABLE_CELL =
  'border-b border-white/10 px-4 py-3 text-sm text-gray-200';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  parsed: ConversationDecodePreview | null;
};

function DecodedSegmentTable({
  parsed,
}: {
  parsed: ConversationDecodePreview;
}) {
  if (parsed.segments.length === 0) {
    return (
      <p className='rounded-lg border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-gray-500'>
        No decoded segments found in this file.
      </p>
    );
  }

  return (
    <div className='max-h-[min(58vh,520px)] overflow-auto rounded-lg border border-white/10'>
      <table className='w-full min-w-[760px] border-collapse text-left'>
        <thead className='sticky top-0 z-10 bg-[#242424] text-xs uppercase tracking-wide text-gray-500'>
          <tr>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Block</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Seg #</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Segment</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Field</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium'>Value</th>
            <th className='border-b border-white/10 px-4 py-3 font-medium text-right'>
              Field #
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-white/5 bg-black/20'>
          {parsed.segments.flatMap((segment) =>
            segment.fields.map((field, fieldIdx) => (
              <tr
                key={`${segment.blockIndex}-${segment.segmentIndex}-${field.fieldNo}-${field.fieldName}-${fieldIdx}`}
              >
                <td className={`${TABLE_CELL} tabular-nums text-gray-400`}>
                  {fieldIdx === 0 ? `#${segment.blockIndex}` : ''}
                </td>
                <td className={`${TABLE_CELL} tabular-nums text-gray-400`}>
                  {fieldIdx === 0 ? segment.segmentIndex : ''}
                </td>
                <td className={`${TABLE_CELL} font-medium text-white`}>
                  {fieldIdx === 0 ? segment.segment : ''}
                </td>
                <td className={TABLE_CELL}>{field.fieldName}</td>
                <td className={`${TABLE_CELL} font-mono text-[#80deea]`}>
                  {field.value || '—'}
                </td>
                <td className={`${TABLE_CELL} text-right tabular-nums text-gray-400`}>
                  {field.fieldNo}
                </td>
              </tr>
            )),
          )}
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

  const fieldCount = parsed.segments.reduce(
    (sum, segment) => sum + segment.fields.length,
    0,
  );

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
            Instrument log decode preview
          </h2>
          <p className='mt-1 text-sm text-gray-500'>
            {parsed.fileName} — {parsed.blockCount} message block
            {parsed.blockCount === 1 ? '' : 's'},{' '}
            {parsed.segments.length} segment
            {parsed.segments.length === 1 ? '' : 's'},{' '}
            {fieldCount} mapped field
            {fieldCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className='flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6'>
          {parsed.parseError ? (
            <p
              className='rounded-lg border border-rose-800/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100'
              role='alert'
            >
              {parsed.parseError}
            </p>
          ) : (
            <div>
              <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-[#00bcd4]'>
                Decoded mapping (conversation)
              </h3>
              <DecodedSegmentTable parsed={parsed} />
            </div>
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
