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
            <div className="hidden md:flex space-x-6">
              <Link href="/" data-testid="link-dashboard">
                <span className={`transition-colors ${location === "/" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
                  Dashboard
                </span>
              </Link>
              <Link href="/plots/new" data-testid="link-new-plot">
                <span className={`transition-colors ${location === "/plots/new" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
                  Add Plot
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
