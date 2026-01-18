import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-200">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-gray-600">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/" className="btn-primary">
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Link>
          <Link to="/catalog" className="btn-secondary">
            <Search className="h-4 w-4 mr-2" />
            Browse Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
