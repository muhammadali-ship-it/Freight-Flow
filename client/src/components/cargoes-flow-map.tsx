import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Skeleton } from "@/components/ui/skeleton";

interface CargoesFlowMapProps {
  shipmentNumber: string;
}

interface MapData {
  shipmentLocation?: {
    lat: number;
    lon: number;
    locationTimestamp: string;
    locationType: string;
    locationLabel: string;
    vesselName?: string;
  };
  journeyStops?: Array<{
    name: string;
    type: string;
    isFuture: boolean;
    lat: number;
    lon: number;
    displayNamePermanently: boolean;
  }>;
  routes?: {
    shipToPort: Array<{ lat: number; lon: number }>;
    portToPort: Array<{ lat: number; lon: number }>;
  };
}

export function CargoesFlowMap({ shipmentNumber }: CargoesFlowMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const { data: mapData, isLoading, error } = useQuery<MapData>({
    queryKey: ["/api/cargoes-flow/map-routes", shipmentNumber],
  });

  useEffect(() => {
    if (!mapRef.current || !mapData) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([20, 0], 2);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    const createStopIcon = (color: string, size: number) => L.divIcon({
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      `,
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const vesselIcon = L.divIcon({
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #8b5cf6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          position: relative;
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      `,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const processedStops = new Set<string>();
    
    if (mapData.journeyStops && mapData.journeyStops.length > 0) {
      mapData.journeyStops.forEach((stop) => {
        if (!stop || !stop.lat || !stop.lon) return;
        const stopKey = `${stop.lat}-${stop.lon}-${stop.type}`;
        if (processedStops.has(stopKey)) return;
        processedStops.add(stopKey);

        let color = "#f59e0b";
        let size = 16;
        let label = "Transshipment Port";

        if (stop.type === "ORIGIN" || stop.type === "ORIGIN_PORT" || stop.type === "ORIGIN_HUB") {
          color = "#3b82f6";
          size = 20;
          label = "Origin";
        } else if (stop.type === "DESTINATION" || stop.type === "DESTINATION_PORT" || stop.type === "DESTINATION_HUB") {
          color = "#10b981";
          size = 20;
          label = "Destination";
        }

        const icon = createStopIcon(color, size);
        const marker = L.marker([stop.lat, stop.lon], { icon }).addTo(map);
        
        if (stop.displayNamePermanently || stop.type.includes("ORIGIN") || stop.type.includes("DESTINATION")) {
          const tooltip = L.tooltip({
            permanent: true,
            direction: 'top',
            className: 'custom-tooltip',
            offset: [0, -10]
          }).setContent(`
            <div style="
              font-family: system-ui, sans-serif;
              background: white;
              padding: 4px 8px;
              border-radius: 4px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              font-size: 12px;
              font-weight: 500;
              white-space: nowrap;
              border: 1px solid #e5e7eb;
            ">${stop.name}</div>
          `);
          marker.bindTooltip(tooltip);
        }
        
        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <strong style="font-size: 14px;">${stop.name}</strong>
            </div>
            <div style="font-size: 11px; color: #666;">${label}</div>
            ${stop.isFuture ? '<div style="font-size: 10px; color: #10b981; margin-top: 2px; font-weight: 500;">Upcoming</div>' : '<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Completed</div>'}
          </div>
        `);
        
        bounds.extend([stop.lat, stop.lon]);
      });
    }

    if (mapData.routes?.portToPort && mapData.routes.portToPort.length > 0) {
      const routeCoordinates: L.LatLngExpression[] = mapData.routes.portToPort
        .filter((point) => point.lat && point.lon)
        .map((point) => [point.lat, point.lon]);

      let vesselIndex = -1;
      if (mapData.shipmentLocation && mapData.shipmentLocation.lat && mapData.shipmentLocation.lon) {
        const vesselLat = mapData.shipmentLocation.lat;
        const vesselLon = mapData.shipmentLocation.lon;
        
        let minDistance = Infinity;
        routeCoordinates.forEach((coord, index) => {
          const [lat, lon] = coord as [number, number];
          const distance = Math.sqrt(
            Math.pow(lat - vesselLat, 2) + Math.pow(lon - vesselLon, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            vesselIndex = index;
          }
        });
      }

      if (vesselIndex > 0) {
        const actualRoute = L.polyline(routeCoordinates.slice(0, vesselIndex + 1), {
          color: "#1e293b",
          weight: 3,
          opacity: 1,
        }).addTo(map);

        const expectedRoute = L.polyline(routeCoordinates.slice(vesselIndex), {
          color: "#94a3b8",
          weight: 3,
          opacity: 0.6,
          dashArray: "10, 10",
        }).addTo(map);
      } else {
        const expectedRoute = L.polyline(routeCoordinates, {
          color: "#94a3b8",
          weight: 3,
          opacity: 0.6,
          dashArray: "10, 10",
        }).addTo(map);
      }

      mapData.routes.portToPort.forEach((point: any, index: number) => {
        if (!point || !point.lat || !point.lon) return;
        
        const isCompleted = vesselIndex >= 0 && index <= vesselIndex;
        const waypointColor = isCompleted ? "#1e293b" : "#94a3b8";
        const waypointSize = 8;
        
        const waypointIcon = createStopIcon(waypointColor, waypointSize);
        const marker = L.marker([point.lat, point.lon], { icon: waypointIcon }).addTo(map);
        
        if (point.locationName) {
          const tooltip = L.tooltip({
            permanent: true,
            direction: 'top',
            className: 'custom-tooltip',
            offset: [0, -6]
          }).setContent(`
            <div style="
              font-family: system-ui, sans-serif;
              background: white;
              padding: 2px 6px;
              border-radius: 3px;
              box-shadow: 0 1px 4px rgba(0,0,0,0.15);
              font-size: 11px;
              font-weight: 500;
              white-space: nowrap;
              border: 1px solid #e5e7eb;
            ">${point.locationName}</div>
          `);
          marker.bindTooltip(tooltip);
        }
        
        const popupContent = `
          <div style="font-family: system-ui, sans-serif; padding: 6px;">
            <div style="font-size: 12px; font-weight: 500; margin-bottom: 2px;">
              ${point.locationName || 'Waypoint'}
            </div>
            <div style="font-size: 10px; color: #666;">
              ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}
            </div>
            ${isCompleted ? '<div style="font-size: 10px; color: #1e293b; margin-top: 2px;">Completed</div>' : '<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Upcoming</div>'}
          </div>
        `;
        marker.bindPopup(popupContent);
        
        bounds.extend([point.lat, point.lon]);
      });
    }

    if (mapData.shipmentLocation && mapData.shipmentLocation.lat && mapData.shipmentLocation.lon) {
      const marker = L.marker(
        [mapData.shipmentLocation.lat, mapData.shipmentLocation.lon],
        { icon: vesselIcon }
      ).addTo(map);
      
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 6px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
              <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
              <path d="M12 10v4"/>
              <path d="M12 2v3"/>
            </svg>
            <strong style="font-size: 14px;">${mapData.shipmentLocation.vesselName || mapData.shipmentLocation.locationLabel || "Vessel"}</strong>
          </div>
          <div style="font-size: 11px; color: #666;">Current Position</div>
          ${mapData.shipmentLocation.locationTimestamp ? `<div style="font-size: 10px; color: #999; margin-top: 2px;">${new Date(mapData.shipmentLocation.locationTimestamp).toLocaleString()}</div>` : ''}
        </div>
      `);
      
      bounds.extend([mapData.shipmentLocation.lat, mapData.shipmentLocation.lon]);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapData]);

  if (isLoading) {
    return <Skeleton className="w-full h-[500px] rounded-lg" />;
  }

  if (error || !mapData) {
    return (
      <div className="w-full h-[500px] rounded-lg border border-border flex items-center justify-center text-muted-foreground">
        <p>Map data not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={mapRef}
        className="w-full h-[500px] rounded-lg overflow-hidden border border-border"
        data-testid="cargoes-flow-map"
      />
      
      <div className="flex items-center gap-6 text-xs text-muted-foreground p-3 bg-muted/30 rounded-md flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#1e293b]"></div>
          <span>Actual Route</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#94a3b8]" style={{ backgroundImage: "repeating-linear-gradient(to right, #94a3b8 0, #94a3b8 5px, transparent 5px, transparent 10px)" }}></div>
          <span>Expected Route</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-purple-600 border-2 border-white shadow"></div>
          <span>Vessel Position</span>
        </div>
      </div>
    </div>
  );
}
