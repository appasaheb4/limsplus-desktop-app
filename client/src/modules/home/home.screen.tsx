import {useEffect} from 'react';
import './style.css';
const {ipcRenderer} = window.require('electron');

const Home = () => {
  useEffect(() => {
    ipcRenderer.invoke('read-user');
    ipcRenderer.on('send-user', (event, user) => {
      const userIdElement = document.getElementById('userId');
      if (userIdElement) {
        userIdElement.innerText = `Welcome ${user.userId}`;
      }
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
        <div className="flex">
          <span id="userId">Welcome </span>
        </div>
      </div>
      <div className="container">
        <div className="column workspaces">
          <div className="title">Workspaces</div>
          <div className="section">Global</div>
          <button
            className="item"
            onClick={() => {
              // navigate('/integration-gateway');
              // ipcRenderer.send('navigate-to-integration-gateway');
              ipcRenderer.send(
                'navigate-to-integration-gateway',
                '/integration-gateway'
              );
            }}
          >
            Integration Gateway
          </button>
          <button className="item">LimsPlus Lite</button>
          <button className="item">Backup/Restore</button>
        </div>
        <div className="column reports">
          <div className="title">Reports</div>
          <button className="item">Aged/Odd Lot</button>
        </div>
      </div>
    </div>
  );
};

export default Home;
