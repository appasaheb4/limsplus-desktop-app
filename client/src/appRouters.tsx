// Add import statements for your App, LandingPage, Home, Products & Product page
import App from './App';
import Login from './modules/login/login.screen';
import Home from './modules/home/home.screen';
import IntegrationGateway from './modules/integration-gateway/integrationGateway.screen';

const routes = [
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Login />,
      },
      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/dashboard',
        element: <Home />,
      },
      {
        path: '/integration-gateway',
        element: <IntegrationGateway />,
      },
    ],
  },
  {
    path: '/login',
    element: <Login />,
  },
];
export default routes;
