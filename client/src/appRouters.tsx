// Legacy route table — runtime entry uses App.tsx (activation gate → dashboard).
import App from './App';
import Home from './modules/home/home.screen';
import IntegrationGateway from './modules/integration-gateway/integrationGateway.screen';

const routes = [
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
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
];
export default routes;
