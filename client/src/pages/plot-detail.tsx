import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Plot } from "@shared/schema";

export default function PlotDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plot, isLoading, error } = useQuery<Plot>({
    queryKey: ["/api/plots", id],
    enabled: !!id,
  });

  const deletePlotMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/plots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plots"] });
      toast({
        title: "Success",
        description: "Plot deleted successfully",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete plot",
        variant: "destructive",
      });
    },
  });


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


  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !plot) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-primary mb-4" data-testid="text-plot-not-found">
            Plot Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            The plot you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => setLocation("/")} data-testid="button-back-to-dashboard">
            Back to Dashboard
          </Button>
        </div>
      </main>
    );
  }


  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-primary"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-light tracking-tight text-primary" data-testid="text-plot-title">
              {plot.name}
            </h1>
            <p className="text-muted-foreground">Plot details and management</p>
          </div>
        </div>

        {/* Plot Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="mt-2">
                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(plot.status)}`} data-testid="status-plot-detail">
                  {plot.status.charAt(0).toUpperCase() + plot.status.slice(1)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Area</div>
              <div className="text-lg font-semibold mt-1 text-primary" data-testid="text-plot-area">
                {plot.area} m²
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Bamboo Type</div>
              <div className="text-lg font-semibold mt-1 text-primary" data-testid="text-plot-bamboo-type">
                {plot.bambooType}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="text-lg font-semibold mt-1 text-primary" data-testid="text-plot-last-updated">
                {formatDate(plot.updatedAt)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Simulation */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-4 text-primary">Plot Simulation</h3>
              <div className="rounded-lg overflow-hidden">
                <iframe 
                  src="/standalone-sim/index.html"
                  className="w-full h-96 border-0 rounded-lg"
                  title="Bamboo Plot Simulation"
                  data-testid="plot-simulation-iframe"
                />
              </div>
            </CardContent>
          </Card>

          {/* Plot Details */}
          <div className="space-y-6">

            {plot.notes && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium mb-4 text-primary">Management Notes</h3>
                  <p className="text-muted-foreground text-sm" data-testid="text-plot-notes">
                    {plot.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <Button 
            onClick={() => setLocation(`/plots/edit/${id}`)}
            className="px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-edit-plot"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Plot
          </Button>
          <Button 
            variant="outline"
            onClick={() => deletePlotMutation.mutate()}
            disabled={deletePlotMutation.isPending}
            className="px-6 py-3 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            data-testid="button-delete-plot"
          >
            {deletePlotMutation.isPending ? "Deleting..." : "Delete Plot"}
          </Button>
        </div>
      </div>
    </main>
  );
}
