import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icon issue in React
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const API_BASE = "http://localhost:3001";

/**
 * GeoMap Component
 * Fetches analyzed IP data and displays their geographical locations on a world map.
 */
export default function GeoMap({ filename }) {
  const [ips, setIps] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!filename) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setLocations([]);
      try {
        // 1. Get IP analysis (top IPs)
        const res = await fetch(`${API_BASE}/api/files/${filename}/analysis`);
        if (!res.ok) throw new Error("Failed to analyze log file");
        const ipData = await res.json();
        
        // Take top 15 IPs to stay within free API limits
        const topIps = ipData.slice(0, 15);
        setIps(topIps);

        // 2. Fetch Geo data for each IP
        const locPromises = topIps.map(async (item) => {
          try {
            const geoRes = await fetch(`${API_BASE}/api/geo/${item.ip}`);
            if (!geoRes.ok) return null;
            const geoData = await geoRes.json();
            return {
              ...item,
              lat: geoData.latitude,
              lon: geoData.longitude,
              city: geoData.cityName,
              country: geoData.countryName,
            };
          } catch {
            return null;
          }
        });

        const results = await Promise.all(locPromises);
        setLocations(results.filter((l) => l && l.lat && l.lon));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [filename]);

  if (!filename) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-bg-card/40 rounded-xl border border-dashed border-border text-text-muted italic">
        Select a log file above to visualize traffic on the map
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <span className="text-xl">🌍</span> Traffic Geo-Distribution
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Mapping the top {ips.length} remote endpoints for <span className="text-accent-teal font-mono">{filename}</span>
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-accent-teal">
            <div className="w-3 h-3 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
            Resolving locations...
          </div>
        )}
      </div>

      <div className="relative h-[500px] w-full rounded-xl overflow-hidden border border-border shadow-inner bg-bg-card">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-danger text-sm">
            Error: {error}
          </div>
        ) : (
          <MapContainer
            center={[20, 0]}
            zoom={2}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {locations.map((loc, idx) => (
              <Marker key={`${loc.ip}-${idx}`} position={[loc.lat, loc.lon]}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-accent-teal mb-1">{loc.ip}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      {loc.city ? `${loc.city}, ` : ""}{loc.country}
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t pt-2">
                      <span className="text-xs font-medium">Traffic:</span>
                      <span className="text-xs font-mono">{formatBytes(loc.bytes)}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
            <MapUpdater locations={locations} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}

// Helper to auto-fit map bounds when locations change
function MapUpdater({ locations }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lon]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
    }
  }, [locations, map]);
  return null;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
