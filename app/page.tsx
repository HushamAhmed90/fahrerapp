"use client";

import { useEffect, useRef, useState } from "react";
import { db, storage } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

type Stop = {
  id: string;
  name?: string;
  adresse?: string;
  telefon?: string;
  notiz?: string;
  fahrer?: string;
  status?: string;
  nachbar?: string;
  deliveredDate?: string;
  deliveredTime?: string;
  photoUrl?: string;
  lat?: number;
  lng?: number;
  order?: number;
};

type QueuedUpdate = {
  stopId: string;
  data: Record<string, unknown>;
};

const DRIVERS = [
  { name: "mohammed", password: "19901990" },
  { name: "Hisham",   password: "19901990" },
  { name: "Mahmoud",  password: "19901990" },
  { name: "Rainer",   password: "19901990" },
  { name: "Hans",     password: "19901990" },
];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { "Accept-Language": "de" } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

const tulpenSVG = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;opacity:0.07;pointer-events:none;" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
  <ellipse cx="50" cy="90" rx="22" ry="34" fill="#c08878" transform="rotate(-12 50 90)"/>
  <ellipse cx="34" cy="102" rx="17" ry="27" fill="#a06858" transform="rotate(-25 34 102)"/>
  <ellipse cx="66" cy="102" rx="17" ry="27" fill="#a06858" transform="rotate(25 66 102)"/>
  <rect x="48" y="122" width="5" height="80" fill="#6a8a60" rx="2"/>
  <ellipse cx="36" cy="178" rx="18" ry="7" fill="#6a8a60" transform="rotate(-30 36 178)"/>
  <ellipse cx="64" cy="195" rx="16" ry="6" fill="#6a8a60" transform="rotate(20 64 195)"/>
  <ellipse cx="360" cy="70" rx="20" ry="32" fill="#d4a0a0" transform="rotate(10 360 70)"/>
  <ellipse cx="345" cy="82" rx="15" ry="25" fill="#b07878" transform="rotate(-18 345 82)"/>
  <ellipse cx="375" cy="82" rx="15" ry="25" fill="#b07878" transform="rotate(18 375 82)"/>
  <rect x="358" y="100" width="5" height="80" fill="#6a8a60" rx="2"/>
  <ellipse cx="376" cy="158" rx="17" ry="7" fill="#6a8a60" transform="rotate(28 376 158)"/>
  <ellipse cx="200" cy="20" rx="16" ry="26" fill="#c08878" transform="rotate(-4 200 20)"/>
  <ellipse cx="186" cy="30" rx="12" ry="20" fill="#a06858" transform="rotate(-18 186 30)"/>
  <ellipse cx="214" cy="30" rx="12" ry="20" fill="#a06858" transform="rotate(18 214 30)"/>
  <rect x="198" y="44" width="4" height="55" fill="#6a8a60" rx="2"/>
  <ellipse cx="30" cy="420" rx="16" ry="26" fill="#d4a0a0" transform="rotate(-8 30 420)"/>
  <ellipse cx="18" cy="432" rx="12" ry="20" fill="#b07878" transform="rotate(-22 18 432)"/>
  <ellipse cx="42" cy="432" rx="12" ry="20" fill="#b07878" transform="rotate(22 42 432)"/>
  <rect x="28" y="445" width="4" height="65" fill="#6a8a60" rx="2"/>
  <ellipse cx="18" cy="495" rx="16" ry="6" fill="#6a8a60" transform="rotate(-28 18 495)"/>
  <ellipse cx="375" cy="400" rx="15" ry="24" fill="#c08878" transform="rotate(8 375 400)"/>
  <ellipse cx="363" cy="412" rx="11" ry="18" fill="#a06858" transform="rotate(-16 363 412)"/>
  <ellipse cx="387" cy="412" rx="11" ry="18" fill="#a06858" transform="rotate(16 387 412)"/>
  <rect x="373" y="422" width="4" height="60" fill="#6a8a60" rx="2"/>
  <ellipse cx="388" cy="466" rx="14" ry="5" fill="#6a8a60" transform="rotate(25 388 466)"/>
  <ellipse cx="40" cy="780" rx="18" ry="28" fill="#d4a0a0" transform="rotate(-10 40 780)"/>
  <ellipse cx="26" cy="792" rx="14" ry="22" fill="#b07878" transform="rotate(-24 26 792)"/>
  <ellipse cx="54" cy="792" rx="14" ry="22" fill="#b07878" transform="rotate(24 54 792)"/>
  <rect x="38" y="806" width="4" height="70" fill="#6a8a60" rx="2"/>
  <ellipse cx="365" cy="800" rx="18" ry="28" fill="#c08878" transform="rotate(10 365 800)"/>
  <ellipse cx="351" cy="812" rx="14" ry="22" fill="#a06858" transform="rotate(-20 351 812)"/>
  <ellipse cx="379" cy="812" rx="14" ry="22" fill="#a06858" transform="rotate(20 379 812)"/>
  <rect x="363" y="826" width="4" height="65" fill="#6a8a60" rx="2"/>
  <ellipse cx="195" cy="870" rx="15" ry="24" fill="#d4a0a0" transform="rotate(5 195 870)"/>
  <ellipse cx="183" cy="880" rx="11" ry="18" fill="#b07878" transform="rotate(-18 183 880)"/>
  <ellipse cx="207" cy="880" rx="11" ry="18" fill="#b07878" transform="rotate(18 207 880)"/>
</svg>`;

const S = {
  page: {
    minHeight: "100vh",
    background: "#fdf6f0",
    fontFamily: "Georgia, serif",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  inner: { maxWidth: 680, margin: "0 auto", padding: "20px 16px", position: "relative" as const, zIndex: 1 },
  logoArea: { textAlign: "center" as const, padding: "20px 0 14px", borderBottom: "0.5px solid #e8c8c0", marginBottom: 18 },
  company: { color: "#2c1a1a", fontSize: 22, fontWeight: 500, margin: "6px 0 0", fontFamily: "Georgia, serif" },
  brand: { color: "#b07878", fontSize: 10, letterSpacing: 3, textTransform: "uppercase" as const, margin: "4px 0 0", fontFamily: "Arial" },
  welcome: { color: "#2c1a1a", fontSize: 15, fontWeight: 500, margin: 0 },
  welcomeSub: { color: "#b07878", fontSize: 13, display: "block", fontWeight: 400, marginTop: 2, fontFamily: "Arial" },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  logoutBtn: { background: "#f5e8e0", color: "#b07878", border: "0.5px solid #d4a8a8", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Arial", display: "flex", alignItems: "center", gap: 6 },
  sortBtn: { background: "#f0eaf5", color: "#8a5a9a", border: "0.5px solid #c8a8d8", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Arial" },
  offlineBanner: { background: "#fdeedd", border: "0.5px solid #e0b888", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#9a6030", fontSize: 13, fontFamily: "Arial" },
  progressCard: { background: "#fff8f5", border: "0.5px solid #e0b8b0", borderRadius: 16, padding: 16, marginBottom: 16 },
  progressLabel: { color: "#b07878", fontSize: 11, letterSpacing: 1, margin: "0 0 8px", fontFamily: "Arial", textTransform: "uppercase" as const },
  progressBarBg: { background: "#f0ddd8", borderRadius: 999, height: 8, overflow: "hidden" as const },
  progressBarFill: (pct: number) => ({ background: "#c08878", height: "100%", borderRadius: 999, width: `${pct}%`, transition: "width 0.4s ease" }),
  progressCount: { color: "#8a5a5a", fontSize: 13, margin: "8px 0 0", fontWeight: 500, fontFamily: "Arial" },
  stopCard: (done: boolean) => ({
    background: done ? "#f5faf0" : "#fff8f5",
    border: done ? "0.5px solid #a8c8a0" : "0.5px solid #e0b8b0",
    borderRadius: 16, padding: 16, marginBottom: 12,
  }),
  stopNum: { color: "#b07878", fontSize: 11, letterSpacing: 1, margin: "0 0 4px", fontFamily: "Arial", textTransform: "uppercase" as const },
  stopName: { color: "#2c1a1a", fontSize: 16, fontWeight: 500, margin: "0 0 8px", fontFamily: "Georgia, serif" },
  stopInfo: { color: "#8a7070", fontSize: 13, margin: "3px 0", display: "flex", alignItems: "center", gap: 6, fontFamily: "Arial" },
  statusDone: { color: "#5a8a50", fontSize: 13, fontWeight: 500, margin: "8px 0 0", fontFamily: "Arial" },
  divider: { border: "none", borderTop: "0.5px solid #e8d0c8", margin: "10px 0" },
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  btnMaps: { background: "#dde8f5", color: "#4a6a9a", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Arial" },
  btnPhoto: { background: "#eeddf5", color: "#7a4a9a", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Arial" },
  btnOk: { background: "#ddf0e0", color: "#3a7a50", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Arial" },
  btnNachbar: { background: "#fdeedd", color: "#9a6030", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Arial" },
  btnDoor: { background: "#ddf0f0", color: "#3a7a7a", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Arial" },
  btnNg: { background: "#f5dddd", color: "#9a4a4a", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Arial" },
};

export default function DriverPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [tour, setTour] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortingByDistance, setSortingByDistance] = useState(false);
  const [uploadingStop, setUploadingStop] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingStopRef = useRef<string | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => { setIsOnline(true); flushOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.geolocation.getCurrentPosition((pos) => {
      setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
    const saved = localStorage.getItem("driverName");
    if (saved) { setName(saved); setLoggedIn(true); loadTour(saved); }
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  async function flushOfflineQueue() {
    const raw = localStorage.getItem("offlineQueue");
    if (!raw) return;
    const queue: QueuedUpdate[] = JSON.parse(raw);
    for (const item of queue) { try { await updateDoc(doc(db, "touren", item.stopId), item.data); } catch {} }
    localStorage.removeItem("offlineQueue");
    const savedName = localStorage.getItem("driverName");
    if (savedName) await loadTour(savedName);
  }

  async function loadTour(driverName: string) {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "touren"));
      const allStops: Stop[] = [];
      snapshot.forEach((document) => { allStops.push({ id: document.id, ...(document.data() as Omit<Stop, "id">) }); });
      const filtered = allStops
        .filter((stop) => stop.fahrer?.toLowerCase().trim() === driverName.toLowerCase().trim())
        .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      setTour(filtered);
      localStorage.setItem("cachedTour_" + driverName, JSON.stringify(filtered));
    } catch {
      const cached = localStorage.getItem("cachedTour_" + driverName);
      if (cached) setTour(JSON.parse(cached));
    }
    setLoading(false);
  }

  async function updateStatus(stopId: string, data: Record<string, unknown>) {
    const now = new Date();
    const update = {
      ...data,
      deliveredDate: now.toLocaleDateString("de-DE"),
      deliveredTime: now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      updatedAt: now.toISOString(),
    };
    if (!navigator.onLine) {
      const raw = localStorage.getItem("offlineQueue");
      const queue: QueuedUpdate[] = raw ? JSON.parse(raw) : [];
      queue.push({ stopId, data: update });
      localStorage.setItem("offlineQueue", JSON.stringify(queue));
      setTour((prev) => prev.map((s) => (s.id === stopId ? { ...s, ...update } : s)));
      return;
    }
    await updateDoc(doc(db, "touren", stopId), update);
    await loadTour(name);
  }

  function openCamera(stopId: string) {
    pendingStopRef.current = stopId;
    photoInputRef.current?.click();
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const stopId = pendingStopRef.current;
    if (!file || !stopId) return;
    e.target.value = "";
    setUploadingStop(stopId);
    try {
      const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
        navigator.geolocation.getCurrentPosition((pos) => resolve(pos.coords), () => resolve(null), { timeout: 5000 });
      });
      const storageRef = ref(storage, `photos/${stopId}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, file);
      const photoUrl = await getDownloadURL(storageRef);
      await updateStatus(stopId, { status: "Geliefert", photoUrl, ...(coords ? { deliveredLat: coords.latitude, deliveredLng: coords.longitude } : {}) });
    } catch { alert("Foto konnte nicht hochgeladen werden"); }
    setUploadingStop(null);
  }

  async function sortByDistance() {
    setSortingByDistance(true);
    let currentLoc = driverLocation;
    if (!currentLoc) {
      currentLoc = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition((pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => resolve(null));
      });
    }
    if (!currentLoc) { alert("GPS nicht verfügbar"); setSortingByDistance(false); return; }
    const withCoords = await Promise.all(tour.map(async (stop) => {
      if (stop.lat && stop.lng) return stop;
      if (stop.adresse) { const coords = await geocode(stop.adresse); if (coords) return { ...stop, ...coords }; }
      return stop;
    }));
    const loc = currentLoc;
    const sorted = [...withCoords].sort((a, b) => {
      if (a.status && !b.status) return 1;
      if (!a.status && b.status) return -1;
      if (a.lat && a.lng && b.lat && b.lng) return haversine(loc.lat, loc.lng, a.lat, a.lng) - haversine(loc.lat, loc.lng, b.lat, b.lng);
      return 0;
    });
    setTour(sorted);
    setSortingByDistance(false);
  }

  async function login() {
    const found = DRIVERS.find((d) => d.name.toLowerCase() === name.toLowerCase() && d.password === password);
    if (!found) { alert("Falscher Login"); return; }
    localStorage.setItem("driverName", found.name);
    setLoggedIn(true);
    loadTour(found.name);
  }

  function logout() { localStorage.removeItem("driverName"); location.reload(); }

  const deliveredCount = tour.filter((s) => s.status).length;
  const progress = tour.length > 0 ? (deliveredCount / tour.length) * 100 : 0;

  if (!loggedIn) {
    return (
      <main style={{ ...S.page, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div dangerouslySetInnerHTML={{ __html: tulpenSVG }} />
        <div style={{ width: "100%", maxWidth: 420, background: "rgba(253,246,240,0.95)", padding: 35, borderRadius: 24, border: "0.5px solid #e0b8b0", position: "relative", zIndex: 1 }}>
          <div style={S.logoArea}>
            <img src="/logo.png" alt="Dirk Schröder" style={{ width: 100, height: 100, objectFit: "contain", borderRadius: "50%" }} />
            <p style={S.company}>Dirk Schröder</p>
            <p style={S.brand}>· Flower Delivery ·</p>
          </div>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: 14, marginBottom: 12, borderRadius: 12, border: "0.5px solid #d4a8a8", fontSize: 16, background: "#fff8f5", color: "#2c1a1a", boxSizing: "border-box" as const }}
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            style={{ width: "100%", padding: 14, marginBottom: 20, borderRadius: 12, border: "0.5px solid #d4a8a8", fontSize: 16, background: "#fff8f5", color: "#2c1a1a", boxSizing: "border-box" as const }}
          />
          <button onClick={login} style={{ width: "100%", padding: 15, border: "none", borderRadius: 12, background: "#c08878", color: "white", fontWeight: "bold", fontSize: 16, cursor: "pointer", fontFamily: "Arial" }}>
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <div dangerouslySetInnerHTML={{ __html: tulpenSVG }} />
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhotoCapture} />

      <div style={S.inner}>
        <div style={S.logoArea}>
          <img src="/logo.png" alt="Dirk Schröder" style={{ width: 90, height: 90, objectFit: "contain", borderRadius: "50%" }} />
          <p style={S.company}>Dirk Schröder</p>
          <p style={S.brand}>· Flower Delivery ·</p>
        </div>

        {!isOnline && (
          <div style={S.offlineBanner}>
            ⚠️ Offline — Änderungen werden später synchronisiert
          </div>
        )}

        <div style={S.topRow}>
          <p style={S.welcome}>
            {name}
            <span style={S.welcomeSub}>Fahrer</span>
          </p>
          <button onClick={logout} style={S.logoutBtn}>Logout</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <button onClick={sortByDistance} disabled={sortingByDistance} style={{ ...S.sortBtn, opacity: sortingByDistance ? 0.6 : 1 }}>
            {sortingByDistance ? "Sortiere..." : "🗺️ Nach Entfernung sortieren"}
          </button>
        </div>

        <div style={S.progressCard}>
          <p style={S.progressLabel}>Fortschritt</p>
          <div style={S.progressBarBg}>
            <div style={S.progressBarFill(progress)} />
          </div>
          <p style={S.progressCount}>{deliveredCount} von {tour.length} geliefert</p>
        </div>

        {loading && <p style={{ color: "#8a7070", fontFamily: "Arial", fontSize: 14 }}>Tour wird geladen...</p>}

        {tour.map((stop, index) => (
          <div key={stop.id} style={S.stopCard(!!stop.status)}>
            <p style={S.stopNum}>Stop {index + 1}</p>
            <p style={S.stopName}>{stop.name}</p>
            {stop.adresse && <p style={S.stopInfo}>📍 {stop.adresse}</p>}
            {stop.telefon && <p style={S.stopInfo}>📞 {stop.telefon}</p>}
            {stop.notiz && <p style={S.stopInfo}>📝 {stop.notiz}</p>}

            {stop.status && (
              <div style={{ marginTop: 10 }}>
                <p style={S.statusDone}>✅ {stop.status}</p>
                {stop.nachbar && <p style={{ ...S.stopInfo, marginTop: 4 }}>👤 {stop.nachbar}</p>}
                {stop.deliveredDate && <p style={S.stopInfo}>📅 {stop.deliveredDate} {stop.deliveredTime}</p>}
                {stop.photoUrl && <img src={stop.photoUrl} alt="Lieferfoto" style={{ width: "100%", maxWidth: 260, borderRadius: 10, marginTop: 8, border: "0.5px solid #e0b8b0" }} />}
              </div>
            )}

            <hr style={S.divider} />
            <div style={S.btnRow}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.adresse || stop.name || "")}`}
                target="_blank"
                style={{ ...S.btnMaps, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                🗺️ Maps
              </a>
              <button onClick={() => openCamera(stop.id)} disabled={uploadingStop === stop.id} style={{ ...S.btnPhoto, opacity: uploadingStop === stop.id ? 0.6 : 1 }}>
                {uploadingStop === stop.id ? "⏳ Uploading..." : "📸 Foto"}
              </button>
              <button onClick={() => updateStatus(stop.id, { status: "Geliefert" })} style={S.btnOk}>Geliefert</button>
              <button onClick={() => { const n = prompt("Name vom Nachbarn?"); updateStatus(stop.id, { status: "Beim Nachbarn", nachbar: n || "" }); }} style={S.btnNachbar}>Nachbar</button>
              <button onClick={() => updateStatus(stop.id, { status: "Vor die Tür" })} style={S.btnDoor}>Vor die Tür</button>
              <button onClick={() => updateStatus(stop.id, { status: "Falsche Adresse" })} style={S.btnNg}>Falsche Adresse</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
