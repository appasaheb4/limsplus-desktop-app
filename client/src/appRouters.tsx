// Legacy route table — runtime entry uses App.tsx (activation gate → dashboard).
import App from './App';
import Home from './modules/home/home.screen';
import IntegrationPlatform from './modules/integration-platform/integrationPlatform.screen';

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
        path: '/integration-platform',
        element: <IntegrationPlatform />,
      },
    ],
  },
];
export default routes;
