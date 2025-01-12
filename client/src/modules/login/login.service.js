const {ipcRenderer} = require('electron');
const {baseURL} = require('../../../env.js');

function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const message = document.getElementById('message');
  fetch(`${baseURL()}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      companyCode: 'GENEFLOW',
    }),
  })
    .then((response) => response.json())
    .then((response) => {
      if (response?.success) {
        ipcRenderer.invoke('accessToken', response?.accessToken);
        ipcRenderer.invoke('user', response?.user);
        message.textContent = 'Login successful!';
        message.className =
          'mt-4 text-center text-green-500 text-sm font-medium';
        // Navigate to home screen using Electron IPC
        ipcRenderer.send('navigate-to-home-screen');
      } else {
        message.textContent = response?.message;
        message.className = 'mt-4 text-center text-red-500 text-sm font-medium';
      }
    });
}
module.exports = {login};
