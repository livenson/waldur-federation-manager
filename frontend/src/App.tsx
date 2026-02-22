import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Entities from './pages/Entities';
import EntityDetail from './pages/EntityDetail';
import EntityRegister from './pages/EntityRegister';
import TrustChainExplorer from './pages/TrustChainExplorer';
import Policies from './pages/Policies';
import PolicyEditor from './pages/PolicyEditor';
import TrustMarks from './pages/TrustMarks';
import Keys from './pages/Keys';
import Health from './pages/Health';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="entities" element={<Entities />} />
        <Route path="entities/register" element={<EntityRegister />} />
        <Route path="entities/:entityId" element={<EntityDetail />} />
        <Route path="trust-chain" element={<TrustChainExplorer />} />
        <Route path="policies" element={<Policies />} />
        <Route path="policies/new" element={<PolicyEditor />} />
        <Route path="policies/:policyId" element={<PolicyEditor />} />
        <Route path="trust-marks" element={<TrustMarks />} />
        <Route path="keys" element={<Keys />} />
        <Route path="health" element={<Health />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
