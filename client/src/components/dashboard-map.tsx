import { useEffect, useRef } from "react";
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

  useEffect(() => {
    // Load Leaflet CSS and JS dynamically
    const loadLeaflet = async () => {
      // Load CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Load JS
      if (!window.L) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = initializeMap;
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      if (!mapRef.current || !window.L) return;

      // Remove existing map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // If no plots, show default view
      if (!plots || plots.length === 0) {
        const map = window.L.map(mapRef.current).setView([45.5231, -122.6765], 10);
        mapInstanceRef.current = map;

        // Add dark tile layer
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        return;
      }

      // Create new map
      const map = window.L.map(mapRef.current);
      mapInstanceRef.current = map;

      // Add dark tile layer
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Add plots as circles
      const group = window.L.featureGroup();
      
      plots.forEach((plot) => {
        // Calculate circle radius based on plot area (scale it appropriately for map)
        const radius = Math.sqrt(plot.area) * 2; // Adjust multiplier as needed
        
        // Create circle with semi-transparent green
        const circle = window.L.circle([plot.latitude, plot.longitude], {
          color: '#22c55e',
          weight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.3,
          radius: radius
        });

        // Add popup with plot info
        circle.bindPopup(`
          <div style="color: #ffffff; background: transparent; border: none; font-family: Inter, system-ui, sans-serif;">
            <strong style="color: #ffffff;">${plot.name}</strong><br>
            ${plot.area} m² • ${plot.bambooType}<br>
            Status: ${plot.status.charAt(0).toUpperCase() + plot.status.slice(1)}
          </div>
        `);

        group.addLayer(circle);
      });

      // Add the group to the map
      group.addTo(map);

      // Fit map bounds to show all plots
      if (plots.length > 0) {
        map.fitBounds(group.getBounds(), { padding: [20, 20] });
      }
    };

    loadLeaflet();

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [plots]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full min-h-[400px] bg-card border border-border rounded-lg"
      data-testid="dashboard-map-container"
    />
  );
}