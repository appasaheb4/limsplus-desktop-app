import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { useStores } from '../../stores';
import { IpcRendererEvent } from 'electron';
import './style.css';
import { useNavigate } from 'react-router-dom';
import AccountModal from './components/modal-account.component';

const { ipcRenderer } = window.require('electron');

type User = {
  userId: string;
  companyCode: string;
};

const Home = observer(() => {
  const { integrationGatewayStore, localStoragePath } = useStores();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ipcRenderer.invoke('read-user');
    ipcRenderer.on('send-user', (_event: IpcRendererEvent, user: User) => {
      const userIdElement = document.getElementById('userId');
      if (userIdElement) {
        userIdElement.innerText = `Welcome ${user.userId}`;
      }
      integrationGatewayStore.integrationGatewayService.fetchEnvironment({
        code: user.companyCode,
      });
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleSignOut = async () => {
    const checkFileExists = async (filePath: string) => {
      return await ipcRenderer.invoke('check-file-exists', filePath);
    };

    const userDataPath = await ipcRenderer.invoke('get-user-data-path');
    const filePath = `${userDataPath}/user-preferences.json`;

    const fileExists = await checkFileExists(filePath);

    if (fileExists) {
      await ipcRenderer.invoke('remove-file', filePath);
      navigate('/');
    } else {
      alert('Something Went Wrong..');
    }
  };

  return (
    <div className='flex flex-col w-full bg-gradient-to-r from-purple-600 to-blue-500 min-h-screen'>
      <div className='flex header justify-between w-full'>
        <div className='flex'>
          <span className='active'>Origin</span>
          <span>Notification</span>
          <span>Clipboard Parser</span>
        </div>

        <div className='flex text-md relative'>
          <span id='userId' className='cursor-pointer' onClick={toggleMenu}>
            Welcome
          </span>

          {isOpen && (
            <div
              ref={menuRef}
              className='absolute right-0 mt-6 w-48 border rounded-lg shadow-lg bg-[#3a3a3a] text-white'
            >
              <ul className='py-2'>
                <li
                  className='px-4 py-2  font-light hover:text-[#00bcd4] cursor-pointer'
                  onClick={() => {
                    setIsSidebarOpen(true);
                    setIsOpen(false);
                  }}
                >
                  Account
                </li>
                <hr />
                <li
                  className='px-4 py-2  font-light hover:text-[#00bcd4] cursor-pointer'
                  onClick={handleSignOut}
                >
                  Sign out
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className='gap-4 m-4 grid grid-cols-3'>
        <div className='bg-[#2a2a2a] p-2 rounded-md'>
          <div className='bg-[#00bcd4] p-3 text-center rounded-md mb-4'>
            Workspaces
          </div>
          <div className='flex flex-col gap-2'>
            <button
              className='item'
              onClick={() => {
                ipcRenderer.send(
                  'navigate-to-integration-gateway',
                  '/integration-gateway',
                );
              }}
            >
              Integration Gateway
            </button>
            <button
              className='item'
              onClick={() => {
                // ipcRenderer.send(
                //   'navigate-to-iframe-screen',
                //   'https://demo.limsplussolutions.com',
                //   'LimsPlus Lite',
                // );
                ipcRenderer.send(
                  'navigate-to-iframe-screen',
                  integrationGatewayStore.integrationGateway.companyDetails
                    ?.webPortal,
                  'LimsPlus Lite',
                );
              }}
            >
              LimsPlus Lite
            </button>
            <button className='item'>HL7 Message</button>
          </div>
        </div>
        <div className='bg-[#2a2a2a] p-2 rounded-md'>
          <div className='bg-[#00bcd4] p-3 text-center rounded-md mb-4'>
            Reports
          </div>
          <div className='flex flex-col gap-2'>
            <button className='item'>Pending for Processing</button>
            <button className='item'>Pending Result Transmission</button>
            <button className='item'>Pending HL7 Message</button>
          </div>
        </div>
        <div className='bg-[#2a2a2a] p-2 rounded-md'>
          <div className='bg-[#00bcd4] p-3 text-center rounded-md mb-4'>
            Configurations
          </div>
          <div className='flex flex-col gap-2'>
            <button
              className='item'
              onClick={async () => {
                const checkFileExists = async (filePath: string) => {
                  return await ipcRenderer.invoke(
                    'check-file-exists',
                    filePath,
                  );
                };

                // Get the user data path and point to `instrument-logs.txt`
                const filePath =
                  (await ipcRenderer.invoke('get-user-data-path')) +
                  '/instrument-logs/instrument-logs.txt';

                const fileExists = await checkFileExists(filePath);

                if (fileExists) {
                  // Open the text file if it exists
                  await ipcRenderer.invoke('open-file', filePath);
                } else {
                  alert('Log file does not exist');
                }
              }}
            >
              Instrument Logs
            </button>

            <button className='item'>Image Files</button>
            <button className='item'>HL7 Files</button>
            <button className='item'>Backup/Restore</button>
            <button className='item'>FTP Locations</button>
          </div>
        </div>
      </div>
      <AccountModal
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
});

export default Home;
