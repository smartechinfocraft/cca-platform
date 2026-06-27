import { useEffect, useState, useRef } from "react";
import { getLocations } from "../services/programService";

type Location = {
  _id: string;
  title: string;
  city?: string;
  address?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  googleMapUrl?: string;
  isActive?: boolean;
};

// Fallback locations with real California coords in case API has none
const FALLBACK: Location[] = [
  { _id: "f1", title: "Fremont Cricket Ground", city: "Fremont", address: "40000 Mission Blvd, Fremont", state: "CA", zipCode: "94539", latitude: 37.5485, longitude: -121.9886 },
  { _id: "f2", title: "San Jose Academy", city: "San Jose", address: "1500 S 10th St, San Jose", state: "CA", zipCode: "95112", latitude: 37.3382, longitude: -121.8863 },
  { _id: "f3", title: "Dublin Sports Park", city: "Dublin", address: "6361 Clark Ave, Dublin", state: "CA", zipCode: "94568", latitude: 37.7022, longitude: -121.9358 },
  { _id: "f4", title: "Sunnyvale Ground", city: "Sunnyvale", address: "550 E Remington Dr, Sunnyvale", state: "CA", zipCode: "94087", latitude: 37.3688, longitude: -122.0363 },
  { _id: "f5", title: "Cupertino Fields", city: "Cupertino", address: "21011 Homestead Rd, Cupertino", state: "CA", zipCode: "95014", latitude: 37.3230, longitude: -122.0322 },
  { _id: "f6", title: "Milpitas Center", city: "Milpitas", address: "457 E Calaveras Blvd, Milpitas", state: "CA", zipCode: "95035", latitude: 37.4323, longitude: -121.8996 },
];

function Locations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    getLocations()
      .then((data) => {
        const valid = (data ?? []).filter((l: Location) => l.latitude && l.longitude);
        setLocations(valid.length > 0 ? valid : FALLBACK);
      })
      .catch(() => setLocations(FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  // Initialize Leaflet map once locations are loaded
  useEffect(() => {
    if (loading || locations.length === 0 || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized

    // Dynamically load Leaflet CSS + JS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = (window as any).L;
      if (!mapContainerRef.current) return;

      // Calculate center
      const avgLat = locations.reduce((s, l) => s + (l.latitude ?? 0), 0) / locations.length;
      const avgLng = locations.reduce((s, l) => s + (l.longitude ?? 0), 0) / locations.length;

      const map = L.map(mapContainerRef.current, {
        center: [avgLat, avgLng],
        zoom: 10,
        zoomControl: true,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      // Tile layer — clean light theme
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap contributors © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Custom orange marker icon
      const createIcon = (isActive: boolean) => L.divIcon({
        className: "",
        html: `
          <div style="
            width:${isActive ? 44 : 36}px;
            height:${isActive ? 44 : 36}px;
            background:${isActive ? "var(--gold)" : "var(--outfield)"};
            border:3px solid white;
            border-radius:50% 50% 50% 4px;
            transform:rotate(-45deg);
            box-shadow:0 4px 12px rgba(0,0,0,0.25);
            display:flex;
            align-items:center;
            justify-content:center;
            transition:all 0.2s;
          ">
            <span style="transform:rotate(45deg);font-size:${isActive ? 16 : 13}px;">📍</span>
          </div>`,
        iconSize: [isActive ? 44 : 36, isActive ? 44 : 36],
        iconAnchor: [isActive ? 22 : 18, isActive ? 44 : 36],
      });

      // Add markers
      locations.forEach((loc) => {
        if (!loc.latitude || !loc.longitude) return;
        const marker = L.marker([loc.latitude, loc.longitude], { icon: createIcon(false) })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:160px;padding:4px">
              <p style="font-weight:700;font-size:14px;color:var(--outfield);margin:0 0 4px">${loc.title}</p>
              ${loc.city ? `<p style="font-size:12px;color:#64748B;margin:0">${loc.address ?? loc.city}, ${loc.state ?? "CA"}</p>` : ""}
              ${loc.googleMapUrl ? `<a href="${loc.googleMapUrl}" target="_blank" rel="noreferrer" style="font-size:11px;color:var(--gold);text-decoration:none;font-weight:600;display:block;margin-top:6px">Open in Google Maps →</a>` : ""}
            </div>
          `, { maxWidth: 220 });

        marker.on("click", () => setActive(loc._id));
        markersRef.current[loc._id] = marker;
      });

      // Fit bounds
      const coords = locations.filter(l => l.latitude && l.longitude).map(l => [l.latitude!, l.longitude!]);
      if (coords.length > 1) map.fitBounds(coords as any, { padding: [40, 40] });
    };
    document.body.appendChild(script);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading, locations]);

  // Pan to marker when active changes
  useEffect(() => {
    if (!mapRef.current || !active) return;
    const loc = locations.find(l => l._id === active);
    if (loc?.latitude && loc?.longitude) {
      mapRef.current.flyTo([loc.latitude, loc.longitude], 14, { animate: true, duration: 0.8 });
      markersRef.current[active]?.openPopup();
    }
  }, [active, locations]);

  return (
    <section id="locations" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-[var(--gold)] text-xs font-bold tracking-widest uppercase block mb-3">
            Find Us
          </span>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-[var(--outfield)]">
            Training Locations
          </h2>
          <p className="text-slate-500 mt-4 max-w-lg mx-auto">
            Multiple cricket grounds across California — find one near you and start training.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">

          {/* Location list */}
          <div className="lg:col-span-2 space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {loading
              ? [1,2,3,4].map(i => (
                  <div key={i} className="loc-card animate-pulse bg-slate-100 h-20" />
                ))
              : locations.map((loc) => (
                  <button
                    key={loc._id}
                    onClick={() => setActive(active === loc._id ? null : loc._id)}
                    className={`loc-card w-full text-left ${active === loc._id ? "active" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg transition-colors ${
                      active === loc._id ? "bg-[var(--gold)]" : "bg-amber-50"
                    }`}>
                      📍
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--outfield)] text-sm truncate">{loc.title}</p>
                      {loc.city && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {loc.city}{loc.state ? `, ${loc.state}` : ""}
                        </p>
                      )}
                      {loc.address && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{loc.address}</p>
                      )}
                      {loc.googleMapUrl && (
                        <a
                          href={loc.googleMapUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] text-[var(--gold)] font-semibold hover:underline mt-1 block"
                        >
                          Open in Google Maps →
                        </a>
                      )}
                    </div>
                  </button>
                ))
            }
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <div
              ref={mapContainerRef}
              className="w-full h-[520px] rounded-3xl overflow-hidden shadow-xl border border-slate-100"
              style={{ zIndex: 0 }}
            />
            {loading && (
              <div className="w-full h-[520px] rounded-3xl bg-slate-100 animate-pulse flex items-center justify-center absolute inset-0">
                <p className="text-slate-400 text-sm">Loading map…</p>
              </div>
            )}
          </div>
        </div>

        {/* CTA row */}
        <div className="mt-10 text-center">
          <p className="text-sm text-slate-400">
            Click a location above to explore it on the map.
            <span className="mx-2">·</span>
            Can't find one near you?{" "}
            <a href="mailto:hello@californiacricketacademy.org" className="text-[var(--gold)] font-semibold hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

export default Locations;
