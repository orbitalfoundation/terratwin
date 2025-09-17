import { useEffect, useRef, useState } from "react";
import type { Plot } from "@shared/schema";

interface DashboardMapProps {
  plots: Plot[];
}

declare global {
  interface Window {
    L: any;
  }
}

export default function DashboardMap({ plots }: DashboardMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const plotLayersRef = useRef<any>(null);
  
  // Helper function for better error logging
  const errorToString = (error: any): string => {
    if (!error) return 'Unknown error';
    return `${error.name || 'Error'}: ${error.message || 'No message'}\n${error.stack || 'No stack'}`;
  };

  // Enhanced error handling
  useEffect(() => {
    console.info('DashboardMap mounted with plots:', plots?.length || 0);
    
    const handleError = (event: ErrorEvent) => {
      console.error('Global error in DashboardMap:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? errorToString(event.error) : 'No error object'
      });
    };
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection in DashboardMap:', {
        reason: event.reason ? errorToString(event.reason) : event.reason
      });
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
  
  // Load Leaflet assets only once on mount
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        let cssLoaded = false;
        let jsLoaded = false;
        
        const checkReady = () => {
          if (cssLoaded && jsLoaded) {
            setLeafletReady(true);
          }
        };
        
        // Load CSS with unique ID
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.onload = () => {
            cssLoaded = true;
            checkReady();
          };
          link.onerror = (error) => {
            console.error('Error loading Leaflet CSS:', error);
            cssLoaded = true; // Continue anyway
            checkReady();
          };
          document.head.appendChild(link);
        } else {
          cssLoaded = true;
        }

        // Load JS with unique ID and CORS
        if (!document.getElementById('leaflet-js') && !window.L) {
          const script = document.createElement('script');
          script.id = 'leaflet-js';
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => {
            console.info('Leaflet loaded', { hasL: !!window.L, version: window.L?.version });
            jsLoaded = true;
            checkReady();
          };
          script.onerror = (error) => {
            console.error('Error loading Leaflet script:', error);
            // Try fallback CDN
            console.info('Trying fallback CDN...');
            const fallbackScript = document.createElement('script');
            fallbackScript.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
            fallbackScript.crossOrigin = 'anonymous';
            fallbackScript.onload = () => {
              console.info('Leaflet fallback loaded', { hasL: !!window.L, version: window.L?.version });
              jsLoaded = true;
              checkReady();
            };
            fallbackScript.onerror = () => {
              console.error('Both Leaflet CDNs failed');
              jsLoaded = true;
              checkReady();
            };
            document.head.appendChild(fallbackScript);
          };
          document.head.appendChild(script);
        } else {
          jsLoaded = true;
        }
        
        checkReady();
      } catch (error) {
        console.error('Error in loadLeaflet:', errorToString(error));
        setLeafletReady(true); // Continue anyway
      }
    };

    loadLeaflet();
  }, []); // Empty deps - run only on mount

  // Initialize map once when Leaflet is ready
  useEffect(() => {
    if (!leafletReady || !mapRef.current || !window.L) return;
    
    // Only create map if it doesn't exist
    if (!mapInstanceRef.current) {
      try {
        // Log container info
        if (mapRef.current) {
          const rect = mapRef.current.getBoundingClientRect();
          console.info('Creating map with container:', {
            width: rect.width,
            height: rect.height,
            hasLeaflet: !!window.L,
            leafletVersion: window.L?.version
          });
        }
        
        // Create map with default view
        const map = window.L.map(mapRef.current).setView([45.5231, -122.6765], 3);
        mapInstanceRef.current = map;
        console.info('Map created successfully');

        // Add reliable OSM tile layer with fallback
        const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        });
        
        tileLayer.on('tileerror', (e: any) => {
          console.warn('Tile loading error:', e);
        });
        
        tileLayer.addTo(map);

        // Create layer group for plots
        plotLayersRef.current = window.L.featureGroup().addTo(map);
        
        // Force map to recalculate size
        setTimeout(() => {
          map.invalidateSize();
        }, 0);
        
      } catch (error) {
        console.error('Error creating Leaflet map:', errorToString(error));
        showFallbackMessage();
      }
    }
  }, [leafletReady]);
  
  // Update plot layers when plots change
  useEffect(() => {
    if (!mapInstanceRef.current || !plotLayersRef.current || !window.L) return;
    
    try {
      // Clear existing plot layers
      plotLayersRef.current.clearLayers();
      
      if (!plots || plots.length === 0) {
        // Reset to default view if no plots
        mapInstanceRef.current.setView([45.5231, -122.6765], 3);
        return;
      }
      
      const validPlots: Plot[] = [];
      
      plots.forEach((plot) => {
        // Validate coordinates
        const lat = Number(plot.latitude);
        const lng = Number(plot.longitude);
        
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || 
            lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.warn(`Invalid coordinates for plot ${plot.id}:`, lat, lng);
          return;
        }
        
        validPlots.push(plot);
        
        // Use circleMarker for consistent visibility
        const radius = Math.max(4, Math.sqrt(plot.area) / 10);
        
        const circle = window.L.circleMarker([lat, lng], {
          color: '#22c55e',
          weight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.4,
          radius: radius
        });

        // Add popup with plot info
        circle.bindPopup(`
          <div style="color: #ffffff; background: #1e293b; padding: 8px; border-radius: 4px; font-family: Inter, system-ui, sans-serif;">
            <strong style="color: #ffffff;">${plot.name}</strong><br>
            ${plot.area} m² • ${plot.bambooType}<br>
            Status: ${plot.status.charAt(0).toUpperCase() + plot.status.slice(1)}
          </div>
        `);

        plotLayersRef.current.addLayer(circle);
      });

      // Fit bounds only if we have valid plots
      if (validPlots.length > 0 && plotLayersRef.current.getLayers().length > 0) {
        const bounds = plotLayersRef.current.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
          
          // Force size recalculation after bounds change
          setTimeout(() => {
            mapInstanceRef.current.invalidateSize();
          }, 0);
        }
      }
      
    } catch (error) {
      console.error('Error updating plot layers:', errorToString(error));
    }
  }, [plots]);
  
  const showFallbackMessage = () => {
    if (mapRef.current) {
      mapRef.current.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1e293b; color: #64748b; font-family: Inter, sans-serif;">
          <div style="text-align: center;">
            <p>Map temporarily unavailable</p>
            <p style="font-size: 0.875rem; margin-top: 0.5rem;">Plot data is available in the list below</p>
          </div>
        </div>
      `;
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (plotLayersRef.current) {
        plotLayersRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full min-h-[400px] bg-card border border-border rounded-lg"
      data-testid="dashboard-map-container"
    />
  );
}