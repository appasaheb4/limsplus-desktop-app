import {useNavigate} from 'react-router-dom';
import {observer} from 'mobx-react';
import {useEffect} from 'react';
import Background from '../../assets/images/bg-login.png';
import {useStores} from '../../stores';
const {ipcRenderer} = window.require('electron');

const Login = observer(() => {
  const {loginStore} = useStores();
  const navigate = useNavigate();

  useEffect(() => {
    ipcRenderer.on('user', (event, user) => {
      if (user.userId) navigate('/dashboard');
    });
    loginStore.loginService.getCompanyList();
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
      <div className="flex flex-col bg-white p-6 px-20 text-black  rounded-lg shadow-lg items-center h-fit mt-28">
        <h1 className="flex text-2xl font-semibold text-center  mb-6">Login</h1>
        <div className="mb-4">
          <label htmlFor="company" className="block text-sm font-medium  mb-2">
            Company
          </label>
          <select
            id="companyCode"
            className="w-60 px-2 py-2 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onChange={(e) => {
              const companyCode = e.target.value;
              loginStore.updateLogin({
                ...loginStore.login,
                companyCode,
              });
            }}
          >
            <option>Select</option>
            {loginStore.companyList?.map((item: any) => (
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
            className="w-60 px-2 py-2 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
            onChange={(e) => {
              const username = e.target.value;
              loginStore.updateLogin({
                ...loginStore.login,
                username,
              });
            }}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="company" className="block text-sm font-medium  mb-2">
            Lab
          </label>
          <select
            id="lab"
            className="w-60 px-2 py-2 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onChange={(e) => {
              const lab = e.target.value;
              loginStore.updateLogin({
                ...loginStore.login,
                lab,
              });
            }}
          >
            <option>Select</option>
            {loginStore.companyList?.map((item: any) => (
              <option value={item.code}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium  mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            placeholder="Password"
            className="w-60 px-2 py-2 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
            onChange={(e) => {
              const password = e.target.value;
              loginStore.updateLogin({
                ...loginStore.login,
                password,
              });
            }}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white font-medium py-2 rounded-lg hover:from-purple-700 hover:to-blue-600 transition-all duration-300"
          onClick={async () => {
            loginStore.loginService
              .login(loginStore.login)
              .then((response: any) => {
                console.log({response});
                if (response?.success) {
                  ipcRenderer.invoke('accessToken', response?.accessToken);
                  ipcRenderer.invoke('user', response?.user);
                  ipcRenderer.invoke('companyList', loginStore.companyList);
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
});

export default Login;
