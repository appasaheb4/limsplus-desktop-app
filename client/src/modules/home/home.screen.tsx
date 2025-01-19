import {useEffect} from 'react';
import {observer} from 'mobx-react';
import {useStores} from '../../stores';
import './style.css';

const {ipcRenderer, shell} = window.require('electron');

const Home = observer(() => {
  const {integrationGatewayStore} = useStores();
  useEffect(() => {
    ipcRenderer.invoke('read-user');
    ipcRenderer.on('send-user', (event, user) => {
      const userIdElement = document.getElementById('userId');
      if (userIdElement) {
        userIdElement.innerText = `Welcome ${user.userId}`;
      }
      integrationGatewayStore.integrationGatewayService.fetchEnvironment({
        code: user.companyCode,
      });
    });
  }, []);

  return (
    <div className="flex flex-col w-full bg-gradient-to-r from-purple-600 to-blue-500 min-h-screen">
      <div className="flex header justify-between w-full">
        <div className="flex">
          <span className="active">Origin</span>
          <span>Notification</span>
          <span>Clipboard Parser</span>
        </div>
        <div className="flex text-md">
          <span id="userId">Welcome </span>
        </div>
      </div>

      <div className="gap-4 m-4 grid grid-cols-3">
        <div className="bg-[#2a2a2a] p-2 rounded-md">
          <div className="bg-[#00bcd4] p-3 text-center rounded-md mb-4">
            Workspaces
          </div>
          <div className="flex flex-col gap-2">
            <button
              className="item"
              onClick={() => {
                ipcRenderer.send(
                  'navigate-to-integration-gateway',
                  '/integration-gateway'
                );
              }}
            >
              Integration Gateway
            </button>
            <button
              className="item"
              onClick={() => {
                ipcRenderer.send(
                  'navigate-to-iframe-screen',
                  integrationGatewayStore.integrationGateway.companyDetails
                    ?.webPortal
                );
              }}
            >
              LimsPlus Lite
            </button>
            <button className="item">HL7 Message</button>
          </div>
        </div>
        <div className="bg-[#2a2a2a] p-2 rounded-md">
          <div className="bg-[#00bcd4] p-3 text-center rounded-md mb-4">
            Reports
          </div>
          <div className="flex flex-col gap-2">
            <button className="item">Pending for Processing</button>
            <button className="item">Pending Result Transmission</button>
            <button className="item">Pending HL7 Message</button>
          </div>
        </div>
        <div className="bg-[#2a2a2a] p-2 rounded-md">
          <div className="bg-[#00bcd4] p-3 text-center rounded-md mb-4">
            Configurations
          </div>
          <div className="flex flex-col gap-2">
            <button
              className="item"
              onClick={() => {
                shell.openPath(
                  '/Users/appasaheb4/Library/Application Support/limsplus-connect/received-message.json'
                );
              }}
            >
              Instrument Logs
            </button>
            <button className="item">Image Files</button>
            <button className="item">HL7 Files</button>
            <button className="item">Backup/Restore</button>
            <button className="item">FTP Locations</button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Home;
