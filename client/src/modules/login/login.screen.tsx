import './style.css';
const Login = () => {
  return (
    <div className="flex  justify-center w-full pt-28">
      <div className="flex flex-col bg-white p-8  rounded-lg shadow-lg items-center ">
        <h1 className="flex text-2xl font-semibold text-center text-gray-800 mb-6">
          Login
        </h1>
        <form id="loginForm">
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Username
            </label>

            <input
              type="text"
              id="username"
              placeholder="Username"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              placeholder="Password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white font-medium py-2 rounded-lg hover:from-purple-700 hover:to-blue-600 transition-all duration-300"
          >
            Login
          </button>
        </form>
        <p id="message" className="mt-4 text-center text-sm font-medium"></p>
      </div>
    </div>
  );
};

export default Login;
