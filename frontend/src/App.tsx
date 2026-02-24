import { Routes, Route, Navigate } from 'react-router-dom';
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
import Federation from './pages/Federation';
import JoinFederation from './pages/JoinFederation';
import Scenarios from './pages/Scenarios';
import NotFound from './pages/NotFound';
import { useRole } from './contexts/RoleContext';

function ManagerRoute({ children, redirect }: { children: React.ReactNode; redirect: string }) {
  const { isManager } = useRole();
  if (!isManager) return <Navigate to={redirect} replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="federation" element={<Federation />} />
        <Route path="federation/join" element={<ManagerRoute redirect="/federation"><JoinFederation /></ManagerRoute>} />
        <Route path="entities" element={<Entities />} />
        <Route path="entities/register" element={<ManagerRoute redirect="/entities"><EntityRegister /></ManagerRoute>} />
        <Route path="entities/:entityId" element={<EntityDetail />} />
        <Route path="trust-chain" element={<TrustChainExplorer />} />
        <Route path="policies" element={<Policies />} />
        <Route path="policies/new" element={<ManagerRoute redirect="/policies"><PolicyEditor /></ManagerRoute>} />
        <Route path="policies/:policyId" element={<ManagerRoute redirect="/policies"><PolicyEditor /></ManagerRoute>} />
        <Route path="trust-marks" element={<TrustMarks />} />
        <Route path="keys" element={<Keys />} />
        <Route path="scenarios" element={<ManagerRoute redirect="/"><Scenarios /></ManagerRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
