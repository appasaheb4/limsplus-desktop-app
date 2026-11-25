// Legacy route table — runtime entry uses App.tsx (activation gate → dashboard).
import App from './App';
import Workspaces from './modules/workspaces/workspaces.screen';
import IntegrationPlatform from './modules/integration-platform/integrationPlatform.screen';

const routes = [
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Workspaces />,
      },
      {
        path: '/dashboard',
        element: <Workspaces />,
      },
      {
        path: '/integration-platform',
        element: <IntegrationPlatform />,
      },
    ],
  },
];
export default routes;
