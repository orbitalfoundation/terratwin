import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import MapComponent from "@/components/map-component";

export default function NasaMap() {
  const [, setLocation] = useLocation();
  
  const { data: cesiumData } = useQuery<{cesiumKey: string | null}>({
    queryKey: ["/api/cesium-key"],
  });
  
  const cesiumToken = cesiumData?.cesiumKey || "";
  const [lat, setLat] = useState(7.6455);
  const [lon, setLon] = useState(122.4);
  const [enableBoundary, setEnableBoundary] = useState(false);
  
  // Create a default 10-point convex polygon boundary (from the reference code)
  const defaultBoundaryPoints = (() => {
    const numPoints = 10;
    const radius = 600;
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const radiusVariation = radius + Math.sin(i * 1.5) * 100;
      
      points.push({
        x: Math.cos(angle) * radiusVariation,
        z: Math.sin(angle) * radiusVariation
      });
    }
    
    return points;
  })();


  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
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
            <h1 className="text-3xl font-light tracking-tight text-primary" data-testid="text-nasa-map-title">
              NASA Map Engine
            </h1>
            <p className="text-muted-foreground">3D satellite tile visualization using Cesium Ion</p>
          </div>
        </div>

        {/* Configuration */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-4 text-primary">Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="latitude" className="block text-sm font-medium mb-2">
                  Latitude
                </Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="w-full"
                  data-testid="input-latitude"
                />
              </div>
              <div>
                <Label htmlFor="longitude" className="block text-sm font-medium mb-2">
                  Longitude
                </Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                  className="w-full"
                  data-testid="input-longitude"
                />
              </div>
            </div>
            
            {/* Boundary Controls */}
            <div className="mt-6 p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="boundary-switch" className="text-sm font-medium">
                  Enable Boundary & Shader Clipping
                </Label>
                <Switch
                  id="boundary-switch"
                  checked={enableBoundary}
                  onCheckedChange={setEnableBoundary}
                  data-testid="switch-boundary"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {enableBoundary 
                  ? "Boundary walls and terrain clipping active with shader effects" 
                  : "Standard terrain rendering without boundaries"
                }
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {cesiumToken ? "✓ Cesium token loaded from environment" : "⚠ No Cesium token found"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map Container */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-4 text-primary">3D Map View</h2>
            {cesiumToken ? (
              <MapComponent 
                latitude={lat}
                longitude={lon}
                height={600}
                viewMode="orbit"
                enableBoundary={enableBoundary}
                boundaryPoints={enableBoundary ? defaultBoundaryPoints : []}
                onError={(error) => {
                  console.error('NASA Map Error:', error);
                }}
                data-testid="map-component"
              />
            ) : (
              <div className="w-full h-[600px] bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg mb-2">No Cesium Token Available</p>
                  <p className="text-sm">Contact your administrator to set up the CESIUM_KEY secret.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}