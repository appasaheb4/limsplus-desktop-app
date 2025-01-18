import {useNavigate} from 'react-router-dom';
import {useEffect, useState} from 'react';
import {baseURL} from '../../env.js';
import Background from '../../assets/images/bg-login.png';
const {ipcRenderer} = window.require('electron');

const Login = () => {
  const navigate = useNavigate();
  const [companyList, setCompanyList] = useState([]);
  const [inputs, setInputs] = useState({});

  useEffect(() => {
    ipcRenderer.on('user', (event, user) => {
      if (user.userId) navigate('/dashboard');
    });
    fetch(`${baseURL()}/company/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application',
      },
    })
      .then((response) => response.json())
      .then((response) => {
        if (response?.success) {
          setCompanyList(response?.companyList);
        }
      })
      .catch((error) => {
        console.log({error});
      });
    return () => {
      ipcRenderer.removeAllListeners('user');
    };
  }, []);
  return (
    <div
      className="flex justify-center w-full"
      style={{
        backgroundImage: 'url(' + Background + ')',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        width: '100vw',
        height: '100vh',
      }}
    >
      <div className="flex flex-col bg-white p-6 px-20 text-black  rounded-lg shadow-lg items-center h-fit mt-40">
        <h1 className="flex text-2xl font-semibold text-center  mb-6">Login</h1>
        <div className="mb-4">
          <label htmlFor="company" className="block text-sm font-medium  mb-2">
            Company
          </label>
          <select
            id="companyCode"
            className="w-full px-4 py-2 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onChange={(e) => {
              const companyCode = e.target.value;
              setInputs({
                ...inputs,
                companyCode,
              });
            }}
          >
            <option>Select</option>
            {companyList?.map((item: any) => (
              <option value={item.code}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium  mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            placeholder="Username"
            className="w-full px-4 py-2 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
            onChange={(e) => {
              const username = e.target.value;
              setInputs({
                ...inputs,
                username,
              });
            }}
          />
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium  mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            placeholder="Password"
            className="w-full px-4 py-2 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
            onChange={(e) => {
              const password = e.target.value;
              setInputs({
                ...inputs,
                password,
              });
            }}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white font-medium py-2 rounded-lg hover:from-purple-700 hover:to-blue-600 transition-all duration-300"
          onClick={async () => {
            await fetch(`${baseURL()}/auth/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...inputs,
              }),
            })
              .then((response) => response.json())
              .then((response) => {
                console.log({response});
                if (response?.success) {
                  // Navigate to home screen using Electron IPC
                  ipcRenderer.invoke('accessToken', response?.accessToken);
                  ipcRenderer.invoke('user', response?.user);
                  ipcRenderer.invoke('companyList', companyList);
                  navigate('/dashboard');
                } else {
                  alert(response?.message);
                }
              });
          }}
        >
          Login
        </button>

        <p id="message" className="mt-4 text-center text-sm font-medium"></p>
      </div>
    </div>
  );
};

export default Login;
