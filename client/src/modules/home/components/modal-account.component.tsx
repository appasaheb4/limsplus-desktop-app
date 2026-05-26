import { IpcRendererEvent } from 'electron';
import { useEffect, useState } from 'react';
const { ipcRenderer } = window.require('electron');

interface User {
  userId: string;
  companyCode: string;
  environment: string;
}

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const onSendUser = (_event: IpcRendererEvent, userData: User) => {
      setUser(userData);
    };

    ipcRenderer.invoke('read-user');
    ipcRenderer.on('send-user', onSendUser);

    return () => {
      ipcRenderer.removeListener('send-user', onSendUser);
    };
  }, []);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      {isOpen && (
        <div
          className='fixed inset-0 bg-black bg-opacity-50 z-40'
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-lg transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } transition-transform duration-300 ease-in-out z-50`}
      >
        <button
          className='absolute top-4 right-4 text-lg font-bold'
          onClick={onClose}
        >
          ✖
        </button>
        <h2 className='text-2xl font-bold mb-4 p-4'>Account</h2>
        <div className='flex flex-col items-center p-4'>
          <img
            src='https://png.pngtree.com/png-clipart/20190924/original/pngtree-vector-user-young-boy-avatar-icon-png-image_4827810.jpg'
            alt='User Avatar'
            className='w-40 h-50 rounded-full'
          />
          <h3 className='text-xl font-semibold mt-4'>
            {user?.userId || 'Loading...'}
          </h3>
        </div>
        <div className='mt-6 bg-gray-700 text-white p-4 mx-4 rounded-lg'>
          <p>UserId: {user?.userId || 'Loading...'}</p>
          <p>Company: {user?.companyCode || 'Loading...'}</p>
          {/* these value not come in backendSide */}
          {/* <p>Lab: {user?.lab || 'Loading...'}</p>
          <p>Role: {user?.role || 'Loading...'}</p> */}
          <p>Environment: {user?.environment || 'Loading...'}</p>
        </div>
      </div>
    </>
  );
};

export default AccountModal;
