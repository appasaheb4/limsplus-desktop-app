import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './modules/login/login.screen';
import Home from './modules/home/home.screen';
import IntegrationGateway from './modules/integration-gateway/integrationGateway.screen';

import { stores } from './stores';
import { useEffect } from 'react';

/** Temporarily skip login — remove or route via `/login` when auth is wired back. */
function DashboardWithWelcome() {
  return (
    <div className='flex min-h-screen w-full flex-col'>
      <header className='w-full border-b border-neutral-200 bg-neutral-100 px-4 py-3 text-base font-semibold text-neutral-900'>
        Welcome Admin
      </header>
      <Home />
    </div>
  );
}

function App() {
  useEffect(() => {
    stores.setLoading(false);
  });

  return (
    <div className='flex'>
      <Router>
        <Routes>
          <Route path='/' element={<DashboardWithWelcome />} />
          <Route path='/dashboard' element={<DashboardWithWelcome />} />
          <Route path='/login' element={<Login />} />
          <Route path='/integration-gateway' element={<IntegrationGateway />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
