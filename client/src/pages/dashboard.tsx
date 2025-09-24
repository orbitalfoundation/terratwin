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

  // Debug cities for camera testing
  const DEBUG_CITIES = [
    { name: "Origin (0,0)", lat: 0, lng: 0 },
    { name: "East", lat: 0, lng: -20 },
    { name: "West", lat: 0, lng: 20 },
    { name: "North", lat: 20, lng: 0 },
    { name: "South", lat: -20, lng: 0 },
    { name: "New York", lat: 40.7128, lng: -74.0060 },
    { name: "London", lat: 51.5074, lng: -0.1278 },
    { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
    { name: "Paris", lat: 48.8566, lng: 2.3522 },
    { name: "Sydney", lat: -33.8688, lng: 151.2093 },
    { name: "Dubai", lat: 25.2048, lng: 55.2708 },
    { name: "São Paulo", lat: -23.5505, lng: -46.6333 },
    { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
    { name: "Singapore", lat: 1.3521, lng: 103.8198 },
    { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
    { name: "Beijing", lat: 39.9042, lng: 116.4074 },
    { name: "Moscow", lat: 55.7558, lng: 37.6173 },
    { name: "Cairo", lat: 30.0444, lng: 31.2357 },
    { name: "Cape Town", lat: -33.9249, lng: 18.4241 },
    { name: "Mexico City", lat: 19.4326, lng: -99.1332 },
    { name: "Istanbul", lat: 41.0082, lng: 28.9784 },
    { name: "Bangkok", lat: 13.7563, lng: 100.5018 },
    { name: "Seoul", lat: 37.5665, lng: 126.9780 },
    { name: "Buenos Aires", lat: -34.6118, lng: -58.3960 },
    { name: "Toronto", lat: 43.6511, lng: -79.3470 },
    { name: "Lagos", lat: 6.5244, lng: 3.3792 },
    { name: "Jakarta", lat: -6.2088, lng: 106.8456 }
  ];

  // Function to handle focus on a city (for debugging camera)
  const handleFocusOnCity = (city: { name: string; lat: number; lng: number }) => {
    console.log(`Focusing camera on ${city.name} at (${city.lat}, ${city.lng})`);
    setFocusCoordinates({
      latitude: city.lat,
      longitude: city.lng,
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

        {/* Debug: Camera Focus Testing */}
        <Card className="bg-card border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-medium text-primary" data-testid="text-debug-header">
              🐛 Debug: Camera Focus Testing
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Click any city button to test camera panning functionality
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {DEBUG_CITIES.map((city) => (
                <Button
                  key={city.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleFocusOnCity(city)}
                  className="text-xs px-2 py-1 h-8"
                  data-testid={`button-focus-${city.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                >
                  {city.name}
                </Button>
              ))}
            </div>
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
