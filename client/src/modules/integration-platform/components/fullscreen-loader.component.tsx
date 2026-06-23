type Props = {
  show: boolean;
  message?: string;
};

export default function FullscreenLoader({ show, message }: Props) {
  if (!show) return null;

  return (
    <div className='fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm'>
      <div className='flex flex-col items-center gap-4'>
        <div className='relative h-16 w-16'>
          <div className='absolute inset-0 rounded-full border-4 border-white/10' />
          <div className='absolute inset-0 animate-spin rounded-full border-4 border-[#00bcd4] border-t-transparent' />
        </div>
        <p className='text-sm font-medium text-[#e0f7fa]'>
          {message ?? 'Loading, please wait...'}
        </p>
      </div>
    </div>
  );
}

