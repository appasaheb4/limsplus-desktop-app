import {HashRouter as Router, Routes, Route} from 'react-router-dom';
import Login from './modules/login/login.screen';
import Home from './modules/home/home.screen';
import IntegrationGateway from './modules/integration-gateway/integrationGateway.screen';

import {stores} from './stores';

function App() {
  console.log({isLoading: stores.loading});

  return (
    <div className="flex">
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Home />} />
          <Route path="/integration-gateway" element={<IntegrationGateway />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
