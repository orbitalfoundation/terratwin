import { Link, useLocation } from "wouter";

export default function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" data-testid="link-home">
              <div className="text-xl font-semibold tracking-tight text-primary hover:text-accent transition-colors">
                TerraTwin
              </div>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
