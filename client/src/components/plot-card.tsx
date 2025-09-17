import { Link } from "wouter";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Plot } from "@shared/schema";

interface PlotCardProps {
  plot: Plot;
}

export default function PlotCard({ plot }: PlotCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deletePlotMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/plots/${plot.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plots"] });
      toast({
        title: "Success",
        description: "Plot deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to delete plot",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation to plot detail
    e.stopPropagation();
    deletePlotMutation.mutate();
  };

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
    <div className="px-6 py-4 hover:bg-muted/50 transition-colors group" data-testid={`card-plot-${plot.id}`}>
      <Link href={`/plots/${plot.id}`} data-testid={`link-plot-${plot.id}`}>
        <div className="flex items-center justify-between cursor-pointer">
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
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Last updated</div>
              <div className="text-sm text-primary" data-testid={`text-plot-updated-${plot.id}`}>
                {formatDate(plot.updatedAt)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deletePlotMutation.isPending}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive-foreground hover:bg-destructive"
              data-testid={`button-delete-plot-${plot.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Link>
    </div>
  );
}
