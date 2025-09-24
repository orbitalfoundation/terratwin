import { useEffect, useRef, useState } from "react";

interface Simulation3DViewProps {
  plotData?: any;
  className?: string;
}

export default function Simulation3DView({ plotData, className = "" }: Simulation3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeServiceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initSimulation = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamically import the volume service from the standalone simulation  
        const volumeModule = await import('../../../public/standalone-sim/services/volume.js');
        const sysModule = await import('../../../public/standalone-sim/utils/sys.js');
        const { volume_service } = volumeModule;
        const { sys } = sysModule;

        if (!mounted) return;

        // Initialize the volume service using the sys function
        console.log('Simulation3DView: Initializing volume service...');
        
        // Wrap volume service initialization to catch WebGL errors
        try {
          sys(volume_service);
          volumeServiceRef.current = volume_service;
          
          // Give it a moment to initialize, then check if it worked
          setTimeout(() => {
            if (volume_service.renderer && volume_service.scene) {
              console.log('Simulation3DView: Volume service initialized successfully');
              setIsLoading(false);
            } else {
              throw new Error('Volume service failed to initialize renderer');
            }
          }, 100);
          
        } catch (volumeError) {
          console.warn('Volume service initialization failed, falling back to basic 3D view:', volumeError);
          throw volumeError; // Re-throw to trigger the catch block below
        }

        // Cleanup function
        return () => {
          mounted = false;
          // Clean up the volume service if needed
          if (volumeServiceRef.current) {
            // The volume service handles its own cleanup
            console.log('Simulation3DView: Cleaning up volume service');
          }
        };

      } catch (err) {
        console.error('Failed to initialize simulation volume service:', err);
        
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('WebGL') || errorMessage.includes('context')) {
          setError('WebGL is not available in this browser environment. The 3D view requires WebGL support to display the bamboo simulation.');
        } else {
          setError('Failed to load 3D simulation. Please try refreshing the page.');
        }
        setIsLoading(false);
      }
    };

    initSimulation();

    return () => {
      mounted = false;
    };
  }, []);

  // Update scene when plot data changes
  useEffect(() => {
    if (!volumeServiceRef.current || !plotData) return;

    // The volume service will handle plot data updates
    console.log('Simulation3DView: Plot data updated:', plotData);

  }, [plotData]);

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center max-w-md p-4">
          <div className="text-destructive mb-2 text-lg">⚠️ 3D View Unavailable</div>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          {error.includes('WebGL') && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
              <p className="mb-2"><strong>Tip:</strong> To use the 3D view:</p>
              <ul className="text-left space-y-1">
                <li>• Try a different browser (Chrome, Firefox, Safari)</li>
                <li>• Enable hardware acceleration in browser settings</li>
                <li>• Update your graphics drivers</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading 3D View...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      id="threejs-container"
      className={`w-full h-full ${className}`}
      data-testid="simulation-3d-view"
    />
  );
}