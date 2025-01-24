import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './modules/login/login.screen';
import Home from './modules/home/home.screen';
import IntegrationGateway from './modules/integration-gateway/integrationGateway.screen';

import { stores } from './stores';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    stores.setLoading(false);
  });

  return (
    <div className='flex'>
      <Router>
        <Routes>
          <Route path='/' element={<Login />} />
          <Route path='/dashboard' element={<Home />} />
          <Route path='/integration-gateway' element={<IntegrationGateway />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
