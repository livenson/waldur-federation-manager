import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      {/* Main content area offset by sidebar width */}
      <main className="ml-16 lg:ml-64 transition-[margin] duration-200">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
