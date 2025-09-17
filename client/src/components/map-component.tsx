import { useEffect, useRef } from "react";

interface MapComponentProps {
  latitude: number;
  longitude: number;
  plotName: string;
  area: number;
  bambooType: string;
  status: string;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function MapComponent({ 
  latitude, 
  longitude, 
  plotName, 
  area, 
  bambooType, 
  status 
}: MapComponentProps) {
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

      // Create new map
      const map = window.L.map(mapRef.current).setView([latitude, longitude], 16);
      mapInstanceRef.current = map;

      // Add dark tile layer
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Add plot marker
      window.L.marker([latitude, longitude]).addTo(map)
        .bindPopup(`
          <div style="color: #ffffff; background: transparent; border: none; font-family: Inter, system-ui, sans-serif;">
            <strong style="color: #ffffff;">${plotName}</strong><br>
            ${area} m² • ${bambooType}<br>
            Status: ${status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        `);

      // Add plot boundary (example rectangle)
      const offset = 0.001;
      const bounds = [
        [latitude - offset, longitude - offset],
        [latitude + offset, longitude + offset]
      ];

      window.L.rectangle(bounds, {
        color: '#22c55e',
        weight: 2,
        fillColor: '#22c55e',
        fillOpacity: 0.1
      }).addTo(map);
    };

    loadLeaflet();

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, plotName, area, bambooType, status]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full min-h-[384px] bg-card border border-border rounded-lg"
      data-testid="map-container"
    />
  );
}
