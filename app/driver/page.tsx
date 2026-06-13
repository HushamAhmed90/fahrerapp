"use client";

import { useEffect, useState, useRef } from "react";
import { collection, doc, updateDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";

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
  order?: number;
};

const DRIVERS = [
  { name: "mohammed", password: "1234" },
  { name: "Hisham",   password: "2222" },
  { name: "Rainer",   password: "4444" },
  { name: "Hans",     password: "5555" },
];

const btn = (bg: string): React.CSSProperties => ({
  background: bg, color: "white", border: "none",
  padding: "11px 16px", borderRadius: 12, fontWeight: "bold",
  fontSize: 14, cursor: "pointer", flexShrink: 0,
});

export default function DriverPage() {
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [tour, setTour]         = useState<Stop[]>([]);
  const [loading, setLoading]   = useState(false);
  const [nachbarStop, setNachbarStop] = useState<string | null>(null);
  const [nachbarName, setNachbarName] = useState("");
  const prevIds = useRef<Set<string>>(new Set());

  // Auto-login from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("driverName");
    if (saved) { setName(saved); setLoggedIn(true); }
  }, []);

  // Real-time listener
  useEffect(() => {
    if (!loggedIn || !name) return;
    setLoading(true);

    const q = query(collection(db, "touren"), where("fahrer", "==", name));
    const unsub = onSnapshot(q, (snap) => {
      const stops: Stop[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Stop));
      stops.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      setTour(stops);
      setLoading(false);

      // Push notification for new stops
      const newIds = new Set(stops.map(s => s.id));
      if (prevIds.current.size > 0) {
        stops.forEach(s => {
          if (!prevIds.current.has(s.id)) {
            showNotification(`Neuer Stop: ${s.name}`, s.adresse ?? "");
          }
        });
      }
      prevIds.current = newIds;
    });

    return () => unsub();
  }, [loggedIn, name]);

  function showNotification(title: string, body: string) {
    if (typeof window === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/logo.png" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => {
        if (p === "granted") new Notification(title, { body, icon: "/logo.png" });
      });
    }
  }

  function requestNotificationPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then(p => {
        if (p === "granted") showNotification("Benachrichtigungen aktiviert", "Du wirst über neue Stops informiert.");
        else alert("Benachrichtigungen wurden abgelehnt.");
      });
    }
  }

  async function updateStatus(stopId: string, status: string, nachbar = "") {
    const now = new Date();
    await updateDoc(doc(db, "touren", stopId), {
      status, nachbar,
      deliveredDate: now.toLocaleDateString("de-DE"),
      deliveredTime: now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      updatedAt: now.toISOString(),
    });
  }

  function login() {
    const found = DRIVERS.find(d => d.name.toLowerCase() === name.toLowerCase() && d.password === password);
    if (!found) { alert("Falscher Login"); return; }
    localStorage.setItem("driverName", found.name);
    setName(found.name);
    setLoggedIn(true);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function logout() {
    localStorage.removeItem("driverName");
    location.reload();
  }

  function openAllOnMap() {
    const pending = tour.filter(s => !s.status && s.adresse);
    if (pending.length === 0) return;
    const waypoints = pending.slice(0, -1).map(s => encodeURIComponent(s.adresse!)).join("|");
    const dest = encodeURIComponent(pending[pending.length - 1].adresse!);
    const origin = pending[0] ? encodeURIComponent(pending[0].adresse!) : "";
    const url = pending.length === 1
      ? `https://www.google.com/maps/dir/?api=1&destination=${dest}`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, "_blank");
  }

  function navigateTo(adresse: string) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}&travelmode=driving`;
    window.open(url, "_blank");
  }

  const delivered = tour.filter(s => s.status === "Geliefert").length;
  const progress  = tour.length > 0 ? (delivered / tour.length) * 100 : 0;
  const pending   = tour.filter(s => !s.status);
  const done      = tour.filter(s => s.status);

  // ── Login screen ──────────────────────────────────────────
  if (!loggedIn) return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#020617 0%,#04122b 100%)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, fontFamily: "Arial" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(15,23,42,0.88)", padding: 35, borderRadius: 30 }}>
        <img src="/logo.png" alt="logo" style={{ width: 200, display: "block", margin: "0 auto 24px", borderRadius: 20 }} />
        <h1 style={{ color: "white", marginBottom: 24, textAlign: "center", fontSize: 30 }}>Fahrer Login</h1>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && login()}
          style={{ width: "100%", padding: 15, marginBottom: 14, borderRadius: 14, border: "none", fontSize: 16, boxSizing: "border-box" }} />
        <input type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && login()}
          style={{ width: "100%", padding: 15, marginBottom: 20, borderRadius: 14, border: "none", fontSize: 16, boxSizing: "border-box" }} />
        <button onClick={login} style={{ width: "100%", padding: 16, border: "none", borderRadius: 14, background: "linear-gradient(90deg,#22c55e,#16a34a)", color: "white", fontWeight: "bold", fontSize: 18, cursor: "pointer" }}>
          Login
        </button>
      </div>
    </main>
  );

  // ── Nachbar dialog ────────────────────────────────────────
  if (nachbarStop) return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#020617 0%,#04122b 100%)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, fontFamily: "Arial" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "rgba(15,23,42,0.95)", padding: 30, borderRadius: 24 }}>
        <h2 style={{ color: "white", marginBottom: 20 }}>Name vom Nachbarn?</h2>
        <input autoFocus value={nachbarName} onChange={e => setNachbarName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && nachbarName.trim()) { updateStatus(nachbarStop, "Beim Nachbarn", nachbarName); setNachbarStop(null); setNachbarName(""); } }}
          placeholder="Nachbar Name" style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", fontSize: 16, marginBottom: 16, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { updateStatus(nachbarStop, "Beim Nachbarn", nachbarName); setNachbarStop(null); setNachbarName(""); }}
            style={{ ...btn("#f97316"), flex: 1 }}>Bestätigen</button>
          <button onClick={() => { setNachbarStop(null); setNachbarName(""); }}
            style={{ ...btn("#475569"), flex: 1 }}>Abbrechen</button>
        </div>
      </div>
    </main>
  );

  // ── Main driver view ──────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#020617 0%,#04122b 100%)", padding: "20px 16px 40px", fontFamily: "Arial" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.png" alt="logo" style={{ width: 54, borderRadius: 14 }} />
            <div>
              <div style={{ color: "white", fontWeight: "bold", fontSize: 18 }}>{name}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Dirk Schröder FahrerApp</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={requestNotificationPermission} title="Benachrichtigungen"
              style={{ ...btn("#1e40af"), padding: "10px 12px", fontSize: 18 }}>🔔</button>
            <button onClick={logout} style={{ ...btn("#dc2626") }}>Logout</button>
          </div>
        </div>

        {/* Progress */}
        <div style={{ background: "rgba(255,255,255,0.07)", padding: 20, borderRadius: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Fortschritt</span>
            <span style={{ color: "#86efac", fontWeight: "bold" }}>{delivered} / {tour.length}</span>
          </div>
          <div style={{ width: "100%", height: 16, background: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#22c55e,#16a34a)", transition: "width 0.5s" }} />
          </div>
        </div>

        {/* Route map button */}
        {pending.length > 0 && (
          <button onClick={openAllOnMap}
            style={{ ...btn("#7c3aed"), width: "100%", marginBottom: 20, padding: 14, fontSize: 15, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            🗺 Alle {pending.length} Stops als Route öffnen
          </button>
        )}

        {loading && <p style={{ color: "#94a3b8", textAlign: "center" }}>Laden…</p>}

        {/* Pending stops */}
        {pending.map((stop, i) => (
          <div key={stop.id} style={{ background: "rgba(255,255,255,0.08)", padding: 20, borderRadius: 20, marginBottom: 16, borderLeft: "4px solid #3b82f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <h2 style={{ color: "white", margin: 0, fontSize: 17 }}>
                <span style={{ color: "#60a5fa", marginRight: 8 }}>#{i + 1}</span>{stop.name}
              </h2>
            </div>
            {stop.adresse && <p style={{ color: "#cbd5e1", margin: "4px 0", fontSize: 14 }}>📍 {stop.adresse}</p>}
            {stop.telefon && (
              <a href={`tel:${stop.telefon}`} style={{ color: "#7dd3fc", display: "block", margin: "4px 0", fontSize: 14, textDecoration: "none" }}>
                📞 {stop.telefon}
              </a>
            )}
            {stop.notiz && <p style={{ color: "#fcd34d", margin: "4px 0", fontSize: 13 }}>📝 {stop.notiz}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={() => navigateTo(stop.adresse || stop.name || "")} style={{ ...btn("#2563eb") }}>
                🧭 Navigieren
              </button>
              <button onClick={() => updateStatus(stop.id, "Geliefert")} style={btn("#22c55e")}>✅ Geliefert</button>
              <button onClick={() => { setNachbarStop(stop.id); setNachbarName(""); }} style={btn("#f97316")}>🚪 Nachbar</button>
              <button onClick={() => updateStatus(stop.id, "Vor die Tür")} style={btn("#0f766e")}>🚪 Vor Tür</button>
              <button onClick={() => updateStatus(stop.id, "Falsche Adresse")} style={btn("#dc2626")}>❌ Falsch</button>
            </div>
          </div>
        ))}

        {/* Done stops */}
        {done.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 10 }}>— Erledigt ({done.length}) —</p>
            {done.map(stop => (
              <div key={stop.id} style={{ background: "rgba(22,163,74,0.12)", padding: 16, borderRadius: 16, marginBottom: 10, borderLeft: "4px solid #22c55e", opacity: 0.7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#86efac", fontWeight: "bold", fontSize: 15 }}>✅ {stop.name}</span>
                  <span style={{ color: "#4ade80", fontSize: 12 }}>{stop.deliveredTime}</span>
                </div>
                {stop.adresse && <p style={{ color: "#6b7280", margin: "3px 0 0", fontSize: 13 }}>📍 {stop.adresse}</p>}
                {stop.status !== "Geliefert" && <p style={{ color: "#fb923c", margin: "3px 0 0", fontSize: 13 }}>{stop.status}{stop.nachbar ? ` — ${stop.nachbar}` : ""}</p>}
              </div>
            ))}
          </div>
        )}

        {!loading && tour.length === 0 && (
          <div style={{ textAlign: "center", color: "#475569", marginTop: 60 }}>
            <p style={{ fontSize: 48 }}>📦</p>
            <p>Keine Stops für heute</p>
          </div>
        )}
      </div>
    </main>
  );
}
