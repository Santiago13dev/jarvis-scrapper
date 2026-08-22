"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPin {
  name: string;
  lat: number;
  lng: number;
  category: string;
}

const BOGOTA_PINS: MapPin[] = [
  { name: "La Carreta", lat: 4.6015, lng: -74.0758, category: "Restaurante Cubano" },
  { name: "Café San Alberto", lat: 4.6680, lng: -74.0535, category: "Cafetería Especialidad" },
  { name: "Wok", lat: 4.6715, lng: -74.0555, category: "Restaurante Asiático" },
  { name: "Prudencia", lat: 4.6660, lng: -74.0570, category: "Cocina Colombiana" },
  { name: "Masa Madre", lat: 4.6760, lng: -74.0495, category: "Panadería Artesanal" },
  { name: "Harry Sasson", lat: 4.6695, lng: -74.0480, category: "Restaurante de Autor" },
  { name: "La Puerta Falsa", lat: 4.5965, lng: -74.0750, category: "Ajiaco y Tamales" },
  { name: "Julio & Sofia", lat: 4.6580, lng: -74.0610, category: "Café & Brunch" },
  { name: "Andrés Carne de Res", lat: 4.6850, lng: -74.0385, category: "Restaurante Colombiano" },
  { name: "Abattoir", lat: 4.6425, lng: -74.0630, category: "Restaurante Gourmet" },
  { name: "El Cielo", lat: 4.6130, lng: -74.0645, category: "Restaurante Colombiano" },
  { name: "Salvo Patria", lat: 4.6310, lng: -74.0685, category: "Gastrobar" },
  { name: "El Chango", lat: 4.6470, lng: -74.0590, category: "Mexicano" },
  { name: "Roa", lat: 4.6730, lng: -74.0450, category: "Cocina de Mar" },
  { name: "Bandido Brewing", lat: 4.6600, lng: -74.0465, category: "Cervecería" },
  { name: "Gran Malaga", lat: 4.6645, lng: -74.0510, category: "Bar & Cocina" },
  { name: "Coscús", lat: 4.6250, lng: -74.0630, category: "Restaurante Árabe" },
  { name: "Quinua y Amaranto", lat: 4.6615, lng: -74.0520, category: "Restaurante Vegano" },
  { name: "La Brasa", lat: 4.6540, lng: -74.0670, category: "Pollos a la Brasa" },
  { name: "Bogotá Beer Company", lat: 4.6745, lng: -74.0475, category: "Cervecería" },
];

function getMarkerColor(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes("café") || cat.includes("panader")) return "#ff8050";
  if (cat.includes("vegan")) return "#00d296";
  if (cat.includes("colomb")) return "#825aff";
  if (cat.includes("bar") || cat.includes("cervec") || cat.includes("gastro")) return "#e650b4";
  if (cat.includes("gourmet") || cat.includes("autor")) return "#468cff";
  return "#825aff";
}

export function BogotaMapInner() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [4.6530, -74.0580],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    BOGOTA_PINS.forEach((pin) => {
      const color = getMarkerColor(pin.category);

      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${color};
            box-shadow: 0 0 12px ${color}80, 0 0 4px ${color};
            border: 2px solid ${color}40;
            position: relative;
          ">
            <div style="
              position: absolute;
              inset: -6px;
              border-radius: 50%;
              background: ${color}20;
              animation: pulse-ring 2s ease-out infinite;
            "></div>
          </div>
        `,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      L.marker([pin.lat, pin.lng], { icon })
        .bindPopup(
          `<div style="
            background: #10121e;
            border: 1px solid rgba(30,34,54,0.8);
            border-radius: 10px;
            padding: 10px 14px;
            min-width: 160px;
            font-family: system-ui, sans-serif;
          ">
            <div style="font-weight: 600; font-size: 13px; color: #e8eaf2; margin-bottom: 4px;">${pin.name}</div>
            <div style="font-size: 11px; color: #828aa4;">${pin.category}</div>
          </div>`,
          { className: "dark-popup" }
        )
        .addTo(map);
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  return <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: "280px" }} />;
}
