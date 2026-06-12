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

    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    navigator.geolocation.getCurrentPosition((pos) => {
      setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });

    const saved = localStorage.getItem("driverName");
    if (saved) {
      setName(saved);
      setLoggedIn(true);
      loadTour(saved);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function flushOfflineQueue() {
    const raw = localStorage.getItem("offlineQueue");
    if (!raw) return;
    const queue: QueuedUpdate[] = JSON.parse(raw);
    for (const item of queue) {
      try {
        await updateDoc(doc(db, "touren", item.stopId), item.data);
      } catch {}
    }
    localStorage.removeItem("offlineQueue");
    const savedName = localStorage.getItem("driverName");
    if (savedName) await loadTour(savedName);
  }

  async function loadTour(driverName: string) {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "touren"));
      const allStops: Stop[] = [];
      snapshot.forEach((document) => {
        allStops.push({ id: document.id, ...(document.data() as Omit<Stop, "id">) });
      });
      const filtered = allStops.filter(
        (stop) => stop.fahrer?.toLowerCase().trim() === driverName.toLowerCase().trim()
      );
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
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          () => resolve(null),
          { timeout: 5000 }
        );
      });

      const storageRef = ref(storage, `photos/${stopId}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, file);
      const photoUrl = await getDownloadURL(storageRef);

      await updateStatus(stopId, {
        status: "Geliefert",
        photoUrl,
        ...(coords ? { deliveredLat: coords.latitude, deliveredLng: coords.longitude } : {}),
      });
    } catch {
      alert("Foto konnte nicht hochgeladen werden");
    }
    setUploadingStop(null);
  }

  async function sortByDistance() {
    setSortingByDistance(true);

    let currentLoc = driverLocation;
    if (!currentLoc) {
      currentLoc = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null)
        );
      });
    }

    if (!currentLoc) {
      alert("GPS nicht verfügbar");
      setSortingByDistance(false);
      return;
    }

    const withCoords = await Promise.all(
      tour.map(async (stop) => {
        if (stop.lat && stop.lng) return stop;
        if (stop.adresse) {
          const coords = await geocode(stop.adresse);
          if (coords) return { ...stop, ...coords };
        }
        return stop;
      })
    );

    const loc = currentLoc;
    const sorted = [...withCoords].sort((a, b) => {
      if (a.status && !b.status) return 1;
      if (!a.status && b.status) return -1;
      if (a.lat && a.lng && b.lat && b.lng) {
        return (
          haversine(loc.lat, loc.lng, a.lat, a.lng) -
          haversine(loc.lat, loc.lng, b.lat, b.lng)
        );
      }
      return 0;
    });

    setTour(sorted);
    setSortingByDistance(false);
  }

  async function login() {
    const found = DRIVERS.find(
      (d) => d.name.toLowerCase() === name.toLowerCase() && d.password === password
    );
    if (!found) {
      alert("Falscher Login");
      return;
    }
    localStorage.setItem("driverName", found.name);
    setLoggedIn(true);
    loadTour(found.name);
  }

  function logout() {
    localStorage.removeItem("driverName");
    location.reload();
  }

  const deliveredCount = tour.filter((s) => s.status).length;
  const progress = tour.length > 0 ? (deliveredCount / tour.length) * 100 : 0;

  if (!loggedIn) {
    return (
      <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#020617 0%,#04122b 50%,#020617 100%)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, fontFamily: "Arial" }}>
        <div style={{ width: "100%", maxWidth: 420, background: "rgba(15,23,42,0.88)", padding: 35, borderRadius: 30 }}>
          <img src="/logo.png" alt="logo" style={{ width: 220, display: "block", margin: "0 auto 20px auto", borderRadius: 24 }} />
          <h1 style={{ color: "white", marginBottom: 25, textAlign: "center", fontSize: 34 }}>Fahrer Login</h1>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: 15, marginBottom: 15, borderRadius: 14, border: "none", fontSize: 16 }}
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            style={{ width: "100%", padding: 15, marginBottom: 20, borderRadius: 14, border: "none", fontSize: 16 }}
          />
          <button onClick={login} style={{ width: "100%", padding: 16, border: "none", borderRadius: 14, background: "linear-gradient(90deg,#22c55e,#16a34a)", color: "white", fontWeight: "bold", fontSize: 18, cursor: "pointer" }}>
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#020617 0%,#04122b 50%,#020617 100%)", padding: 20, fontFamily: "Arial" }}>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handlePhotoCapture}
      />

      <div style={{ maxWidth: 950, margin: "0 auto" }}>
        <img src="/logo.png" alt="logo" style={{ width: 150, borderRadius: 22, marginBottom: 20 }} />

        {!isOnline && (
          <div style={{ background: "#f59e0b", color: "#000", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontWeight: "bold" }}>
            ⚠️ Offline — Änderungen werden gespeichert und später synchronisiert
          </div>
        )}

        <h1 style={{ color: "white", marginBottom: 8 }}>Willkommen {name}</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>Dirk Schröder FahrerApp</p>

        <div style={{ display: "flex", gap: 10, marginBottom: 25, flexWrap: "wrap" }}>
          <button onClick={logout} style={{ background: "#dc2626", color: "white", border: "none", padding: "12px 20px", borderRadius: 12, fontWeight: "bold", cursor: "pointer" }}>
            Logout
          </button>
          <button
            onClick={sortByDistance}
            disabled={sortingByDistance}
            style={{ background: "#6366f1", color: "white", border: "none", padding: "12px 20px", borderRadius: 12, fontWeight: "bold", cursor: "pointer", opacity: sortingByDistance ? 0.6 : 1 }}
          >
            {sortingByDistance ? "Sortiere..." : "🗺️ Nach Entfernung sortieren"}
          </button>
        </div>

        <div style={{ background: "rgba(255,255,255,0.08)", padding: 24, borderRadius: 24, marginBottom: 25 }}>
          <h2 style={{ color: "white" }}>Fortschritt</h2>
          <div style={{ width: "100%", height: 20, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#22c55e,#16a34a)", transition: "width 0.4s ease" }} />
          </div>
          <p style={{ color: "#86efac", marginTop: 12, fontWeight: "bold" }}>
            {deliveredCount} von {tour.length} geliefert
          </p>
        </div>

        {loading && <p style={{ color: "white" }}>Tour wird geladen...</p>}

        {tour.map((stop, index) => (
          <div key={stop.id} style={{ background: stop.status ? "rgba(22,163,74,0.16)" : "rgba(255,255,255,0.08)", padding: 24, borderRadius: 24, marginBottom: 22 }}>
            <h2 style={{ color: "white", marginBottom: 12 }}>{index + 1}. {stop.name}</h2>
            {stop.adresse && <p style={{ color: "#d1d5db" }}>📍 {stop.adresse}</p>}
            {stop.telefon && <p style={{ color: "#d1d5db" }}>📞 {stop.telefon}</p>}
            {stop.notiz && <p style={{ color: "#d1d5db" }}>📝 {stop.notiz}</p>}

            {stop.status && (
              <div style={{ marginTop: 10 }}>
                <p style={{ color: "#86efac", fontWeight: "bold" }}>✅ {stop.status}</p>
                {stop.deliveredDate && <p style={{ color: "#d1fae5" }}>📅 {stop.deliveredDate}</p>}
                {stop.deliveredTime && <p style={{ color: "#d1fae5" }}>⏰ {stop.deliveredTime}</p>}
                {stop.photoUrl && (
                  <img src={stop.photoUrl} alt="Lieferfoto" style={{ width: "100%", maxWidth: 300, borderRadius: 12, marginTop: 10 }} />
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.adresse || stop.name || "")}`}
                target="_blank"
                style={{ background: "#2563eb", color: "white", textDecoration: "none", padding: "10px 14px", borderRadius: 10, fontWeight: "bold" }}
              >
                🗺️ Maps
              </a>
              <button
                onClick={() => openCamera(stop.id)}
                disabled={uploadingStop === stop.id}
                style={{ background: "#7c3aed", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer", opacity: uploadingStop === stop.id ? 0.6 : 1 }}
              >
                {uploadingStop === stop.id ? "⏳ Uploading..." : "📸 Foto + Geliefert"}
              </button>
              <button onClick={() => updateStatus(stop.id, { status: "Geliefert" })} style={{ background: "#22c55e", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}>
                Geliefert
              </button>
              <button
                onClick={() => {
                  const nachbar = prompt("Name vom Nachbarn?");
                  updateStatus(stop.id, { status: "Beim Nachbarn", nachbar: nachbar || "" });
                }}
                style={{ background: "#f97316", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
              >
                Nachbar
              </button>
              <button onClick={() => updateStatus(stop.id, { status: "Vor die Tür" })} style={{ background: "#0f766e", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}>
                Vor die Tür
              </button>
              <button onClick={() => updateStatus(stop.id, { status: "Falsche Adresse" })} style={{ background: "#dc2626", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}>
                Falsche Adresse
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
