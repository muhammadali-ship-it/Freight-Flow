import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ShipmentMapProps {
  originPort: string;
  originCoordinates?: { latitude: number; longitude: number };
  destinationPort: string;
  destinationCoordinates?: { latitude: number; longitude: number };
  vesselPosition?: { latitude: number; longitude: number };
  vesselName?: string;
  segments?: Array<{
    origin: string;
    destination: string;
    originPortCode: string;
    destinationPortCode: string;
    transportMode: string;
    etd?: string | null;
    atd?: string | null;
    eta?: string | null;
    ata?: string | null;
  }>;
}

export function ShipmentMap({
  originPort,
  originCoordinates,
  destinationPort,
  destinationCoordinates,
  vesselPosition,
  vesselName,
  segments = [],
}: ShipmentMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    const originIcon = L.divIcon({
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #10b981;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const destinationIcon = L.divIcon({
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const vesselIcon = L.divIcon({
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background: #8b5cf6;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          position: relative;
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      `,
      className: "",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (originCoordinates && originCoordinates.latitude !== null && originCoordinates.longitude !== null) {
      const marker = L.marker([originCoordinates.latitude, originCoordinates.longitude], {
        icon: originIcon,
      }).addTo(map);
      
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
            </svg>
            <strong style="font-size: 14px;">${originPort}</strong>
          </div>
          <div style="font-size: 11px; color: #666;">Origin Port</div>
        </div>
      `);
      
      bounds.extend([originCoordinates.latitude, originCoordinates.longitude]);
    }

    if (destinationCoordinates && destinationCoordinates.latitude !== null && destinationCoordinates.longitude !== null) {
      const marker = L.marker(
        [destinationCoordinates.latitude, destinationCoordinates.longitude],
        { icon: destinationIcon }
      ).addTo(map);
      
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
            </svg>
            <strong style="font-size: 14px;">${destinationPort}</strong>
          </div>
          <div style="font-size: 11px; color: #666;">Destination Port</div>
        </div>
      `);
      
      bounds.extend([destinationCoordinates.latitude, destinationCoordinates.longitude]);
    }

    if (
      originCoordinates && 
      originCoordinates.latitude !== null && 
      originCoordinates.longitude !== null &&
      destinationCoordinates && 
      destinationCoordinates.latitude !== null && 
      destinationCoordinates.longitude !== null
    ) {
      const routePoints: L.LatLngExpression[] = [[originCoordinates.latitude, originCoordinates.longitude]];
      
      if (vesselPosition && vesselPosition.latitude !== null && vesselPosition.longitude !== null) {
        routePoints.push([vesselPosition.latitude, vesselPosition.longitude]);
      }
      
      routePoints.push([destinationCoordinates.latitude, destinationCoordinates.longitude]);

      const actualRoute = L.polyline(
        vesselPosition && vesselPosition.latitude !== null && vesselPosition.longitude !== null
          ? [[originCoordinates.latitude, originCoordinates.longitude], [vesselPosition.latitude, vesselPosition.longitude]]
          : [],
        {
          color: "#1e293b",
          weight: 3,
          opacity: 0.8,
        }
      ).addTo(map);

      const expectedRoute = L.polyline(
        vesselPosition && vesselPosition.latitude !== null && vesselPosition.longitude !== null
          ? [[vesselPosition.latitude, vesselPosition.longitude], [destinationCoordinates.latitude, destinationCoordinates.longitude]]
          : [[originCoordinates.latitude, originCoordinates.longitude], [destinationCoordinates.latitude, destinationCoordinates.longitude]],
        {
          color: "#1e293b",
          weight: 3,
          opacity: 0.5,
          dashArray: "10, 10",
        }
      ).addTo(map);
    }

    if (vesselPosition && vesselPosition.latitude !== null && vesselPosition.longitude !== null) {
      const marker = L.marker([vesselPosition.latitude, vesselPosition.longitude], {
        icon: vesselIcon,
      }).addTo(map);
      
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
              <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
              <path d="M12 10v4"/>
              <path d="M12 2v3"/>
            </svg>
            <strong style="font-size: 14px;">${vesselName || "Vessel"}</strong>
          </div>
          <div style="font-size: 11px; color: #666;">Current Position</div>
        </div>
      `);
      
      bounds.extend([vesselPosition.latitude, vesselPosition.longitude]);
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
  }, [originPort, originCoordinates, destinationPort, destinationCoordinates, vesselPosition, vesselName]);

  return (
    <div className="space-y-4">
      <div
        ref={mapRef}
        className="w-full h-[500px] rounded-lg overflow-hidden border border-border"
        data-testid="shipment-map"
      />
      
      <div className="flex items-center gap-6 text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#1e293b]"></div>
          <span>Actual Route</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#1e293b] opacity-50" style={{ backgroundImage: "repeating-linear-gradient(to right, #1e293b 0, #1e293b 5px, transparent 5px, transparent 10px)" }}></div>
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
