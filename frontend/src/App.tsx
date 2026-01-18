import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import Instances from './pages/Instances';
import Connections from './pages/Connections';
import Monitoring from './pages/Monitoring';
import FederationAdmin from './pages/FederationAdmin';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="federations/:federationSlug" element={<Dashboard />} />
        <Route path="federations/:federationSlug/instances" element={<Instances />} />
        <Route path="federations/:federationSlug/connections" element={<Connections />} />
        <Route path="federations/:federationSlug/monitoring" element={<Monitoring />} />
        <Route path="federations/:federationSlug/admin" element={<FederationAdmin />} />
        {/* Redirect old routes */}
        <Route path="catalog" element={<Navigate to="/" replace />} />
        <Route path="provider" element={<Navigate to="/" replace />} />
        <Route path="export" element={<Navigate to="/" replace />} />
        <Route path="admin" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
