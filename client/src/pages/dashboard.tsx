import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PlotCard from "@/components/plot-card";
import MapComponent from "@/components/map-component";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Plot } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Focus state for map camera
  const [focusCoordinates, setFocusCoordinates] = useState<{
    latitude: number;
    longitude: number;
    trigger: number;
  } | null>(null);
  
  const { data: plots, isLoading } = useQuery<Plot[]>({
    queryKey: ["/api/plots"],
  });

  // Function to handle focus on a plot
  const handleFocusOnPlot = (plot: Plot) => {
    setFocusCoordinates({
      latitude: plot.latitude,
      longitude: plot.longitude,
      trigger: Date.now() // Use timestamp to trigger animation
    });
  };



  const totalPlots = plots?.length || 0;
  const totalArea = plots?.reduce((sum, plot) => sum + plot.area, 0) || 0;
  const activePlots = plots?.filter(plot => plot.status === "active").length || 0;

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-primary" data-testid="text-dashboard-title">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1" data-testid="text-dashboard-subtitle">
              Manage your bamboo cultivation plots
            </p>
          </div>
          <div className="flex space-x-3">
            <Link href="/plots/new" data-testid="link-add-plot">
              <Button className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4 mr-2" />
                Add New Plot
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="text-2xl font-semibold text-primary" data-testid="text-total-plots">
                {totalPlots}
              </div>
              <div className="text-muted-foreground mt-1">Total Plots</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="text-2xl font-semibold text-primary" data-testid="text-total-area">
                {totalArea.toLocaleString()} m²
              </div>
              <div className="text-muted-foreground mt-1">Total Area</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="text-2xl font-semibold text-primary" data-testid="text-active-plots">
                {activePlots}
              </div>
              <div className="text-muted-foreground mt-1">Active Plots</div>
            </CardContent>
          </Card>
        </div>

        {/* Overview Map */}
        <Card className="bg-card border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-medium text-primary" data-testid="text-map-header">
              Plot Overview Map
            </h2>
          </div>
          <div className="p-6">
            <MapComponent 
              viewMode="globe"
              plots={plots || []} 
              height={400}
              focusLatitude={focusCoordinates?.latitude}
              focusLongitude={focusCoordinates?.longitude}
              focusTrigger={focusCoordinates?.trigger || 0}
              data-testid="dashboard-map-component"
            />
          </div>
        </Card>


        {/* Plots List */}
        <Card className="bg-card border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-medium text-primary" data-testid="text-plots-header">
              Your Plots
            </h2>
          </div>
          <div className="divide-y divide-border">
            {plots && plots.length > 0 ? (
              plots.map((plot) => (
                <PlotCard 
                  key={plot.id} 
                  plot={plot} 
                  onFocusOnMap={() => handleFocusOnPlot(plot)}
                />
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-muted-foreground mb-4" data-testid="text-no-plots">
                  No plots found. Create your first plot to get started.
                </p>
                <Link href="/plots/new" data-testid="link-create-first-plot">
                  <Button>Create Your First Plot</Button>
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
