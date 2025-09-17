import { Link } from "wouter";
import type { Plot } from "@shared/schema";

interface PlotCardProps {
  plot: Plot;
}

export default function PlotCard({ plot }: PlotCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "1 week ago";
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-accent/20 text-accent";
      case "planning":
        return "bg-secondary text-secondary-foreground";
      case "inactive":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Link href={`/plots/${plot.id}`} data-testid={`link-plot-${plot.id}`}>
      <div className="px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`card-plot-${plot.id}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-primary" data-testid={`text-plot-name-${plot.id}`}>
              {plot.name}
            </h3>
            <p className="text-muted-foreground text-sm mt-1" data-testid={`text-plot-coordinates-${plot.id}`}>
              {plot.latitude.toFixed(4)}° N, {Math.abs(plot.longitude).toFixed(4)}° {plot.longitude >= 0 ? 'E' : 'W'}
            </p>
            <div className="flex items-center space-x-4 mt-2">
              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(plot.status)}`} data-testid={`status-plot-${plot.id}`}>
                {plot.status.charAt(0).toUpperCase() + plot.status.slice(1)}
              </span>
              <span className="text-xs text-muted-foreground" data-testid={`text-plot-area-${plot.id}`}>
                {plot.area} m²
              </span>
              <span className="text-xs text-muted-foreground" data-testid={`text-plot-bamboo-type-${plot.id}`}>
                Bamboo Type: {plot.bambooType}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Last updated</div>
            <div className="text-sm text-primary" data-testid={`text-plot-updated-${plot.id}`}>
              {formatDate(plot.updatedAt)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
