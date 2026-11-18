import { useLocation, Link } from '@/lib/router-compat';
import { useEffect } from "react";
import { Compass } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="z-10 text-center bg-card border border-border shadow-lg p-10 rounded-2xl max-w-md w-full flex flex-col items-center">
        <div className="h-16 w-16 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mb-6">
          <Compass className="h-8 w-8 text-primary" />
        </div>

        <h1 className="mb-2 font-heading text-7xl font-black font-tabular leading-none text-foreground">
          404
        </h1>
        <p className="mb-4 font-heading text-sm font-bold uppercase tracking-widest text-primary">
          Page Not Found
        </p>
        <p className="mb-8 text-xs text-muted-foreground leading-relaxed max-w-sm">
          The requested route <span className="font-mono text-foreground">{location.pathname}</span> does not exist in this workspace.
        </p>

        <Link
          to="/"
          className="rounded-lg bg-primary px-6 py-2.5 font-sans text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
