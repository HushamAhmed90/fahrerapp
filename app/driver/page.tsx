"use client";

import { useEffect, useState, useRef } from "react";
import { collection, doc, updateDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { BremenCrestCard, DigitalClock } from "../components/HeroExtras";

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

const S: Record<string, React.CSSProperties> = {
  page:    { minHeight: "100vh", background: "#fdf6f0", fontFamily: "Arial, sans-serif", padding: "0 0 48px 0" },
  nav:     { background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #f3d5d5", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 },
  logo:    { width: 44, height: 44, borderRadius: 12, objectFit: "contain" as const },
  wrap:    { maxWidth: 680, margin: "0 auto", padding: "28px 16px" },
  card:    { background: "rgba(255,255,255,0.85)", border: "1px solid #f3d5d5", borderRadius: 20, padding: "20px 22px", marginBottom: 16, boxShadow: "0 2px 12px rgba(180,80,80,0.06)" },
  stopNum: { color: "#b91c1c", fontWeight: "bold", fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 4 },
  name:    { color: "#1c1c1c", fontWeight: "bold", fontSize: 17, marginBottom: 8 },
  info:    { color: "#6b5050", fontSize: 14, margin: "3px 0", display: "flex", alignItems: "flex-start", gap: 6 },
  btnRow:  { display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" as const },
};

function Btn({ color, children, onClick }: { color: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ background: color, color: "white", border: "none", padding: "10px 16px", borderRadius: 12, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
      {children}
    </button>
  );
}

export default function DriverPage() {
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [tour, setTour]         = useState<Stop[]>([]);
  const [loading, setLoading]   = useState(false);
  const [nachbarStop, setNachbarStop] = useState<string | null>(null);
  const [nachbarName, setNachbarName] = useState("");
  const prevIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem("driverName");
    if (saved) { setName(saved); setLoggedIn(true); }
  }, []);

  useEffect(() => {
    if (!loggedIn || !name) return;
    setLoading(true);
    const q = query(collection(db, "touren"), where("fahrer", "==", name));
    const unsub = onSnapshot(q, (snap) => {
      const stops: Stop[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Stop));
      stops.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      setTour(stops);
      setLoading(false);
      const newIds = new Set(stops.map(s => s.id));
      if (prevIds.current.size > 0) {
        stops.forEach(s => {
          if (!prevIds.current.has(s.id)) notify(`Neuer Stop: ${s.name}`, s.adresse ?? "");
        });
      }
      prevIds.current = newIds;
    });
    return () => unsub();
  }, [loggedIn, name]);

  function notify(title: string, body: string) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") new Notification(title, { body, icon: "/logo.png" });
    else if (Notification.permission !== "denied") Notification.requestPermission().then(p => { if (p === "granted") new Notification(title, { body, icon: "/logo.png" }); });
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
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }

  function logout() { localStorage.removeItem("driverName"); location.reload(); }

  function navigateTo(adresse: string) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}&travelmode=driving`, "_blank");
  }

  function openAllOnMap() {
    const pending = tour.filter(s => !s.status && s.adresse);
    if (!pending.length) return;
    const dest = encodeURIComponent(pending[pending.length - 1].adresse!);
    const origin = encodeURIComponent(pending[0].adresse!);
    const waypoints = pending.slice(1, -1).map(s => encodeURIComponent(s.adresse!)).join("|");
    const url = pending.length === 1
      ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;
    window.open(url, "_blank");
  }

  const pending = tour.filter(s => !s.status);
  const done    = tour.filter(s => s.status);
  const progress = tour.length > 0 ? (done.length / tour.length) * 100 : 0;

  // ── Login ────────────────────────────────────────────────
  if (!loggedIn) return (
    <main style={{ ...S.page, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {/* Blobs */}
      <div style={{ position: "fixed", top: 0, left: 0, width: "26rem", height: "26rem", background: "rgba(251,207,207,0.35)", borderRadius: "50%", transform: "translate(-40%,-40%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: 0, right: 0, width: "20rem", height: "20rem", background: "rgba(254,243,199,0.35)", borderRadius: "50%", transform: "translate(30%,30%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1000, width: "100%", padding: "0 24px", display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 28, alignItems: "center", position: "relative", zIndex: 1 }}>

        {/* LEFT — Bremen + info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <BremenCrestCard />
          <div style={{ ...S.card, padding: "16px 18px" }}>
            <p style={{ color: "#b91c1c", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>Lieferzeiten</p>
            {[
              { label: "Mo – Fr", time: "04:30 – 10:00 Uhr" },
              { label: "Samstag", time: "04:30 – 09:00 Uhr" },
              { label: "Standort", time: "Am Waller Freihafen 1" },
            ].map(o => (
              <div key={o.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>{o.label}</span>
                <span style={{ color: "#1c1c1c", fontSize: 12, fontWeight: 600 }}>{o.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — Logo big + form below */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <img src="/logo.png" alt="logo" style={{ width: "100%", maxWidth: 340, objectFit: "contain", filter: "drop-shadow(0 8px 24px rgba(180,80,80,0.18))" }} />
          <div style={{ ...S.card, width: "100%", padding: "28px 28px 24px", textAlign: "center" }}>
            <h1 style={{ color: "#7c2d12", fontSize: 22, fontWeight: "bold", marginBottom: 18 }}>Fahrer Login</h1>
            <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && login()}
              style={{ width: "100%", padding: 13, marginBottom: 10, borderRadius: 14, border: "1.5px solid #f3d5d5", fontSize: 15, background: "#fff9f7", boxSizing: "border-box", color: "#1c1c1c" }} />
            <input type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()}
              style={{ width: "100%", padding: 13, marginBottom: 16, borderRadius: 14, border: "1.5px solid #f3d5d5", fontSize: 15, background: "#fff9f7", boxSizing: "border-box", color: "#1c1c1c" }} />
            <button onClick={login} style={{ width: "100%", padding: 14, border: "none", borderRadius: 14, background: "#b91c1c", color: "white", fontWeight: "bold", fontSize: 16, cursor: "pointer", boxShadow: "0 4px 14px rgba(185,28,28,0.25)" }}>
              Anmelden
            </button>
          </div>
        </div>

        {/* RIGHT — Clock + flowers info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DigitalClock />
          <div style={{ ...S.card, padding: "16px 18px" }}>
            <p style={{ color: "#b91c1c", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>Sortiment</p>
            {["🌹 Rosen", "🌷 Tulpen", "🌸 Lilien", "🌼 Chrysanthemen", "🌿 Schnittgrün", "💐 Sträuße"].map(item => (
              <div key={item} style={{ color: "#4b5563", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #fde8e8" }}>{item}</div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );

  // ── Nachbar dialog ───────────────────────────────────────
  if (nachbarStop) return (
    <main style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...S.card, maxWidth: 400, width: "100%", padding: 30 }}>
        <h2 style={{ color: "#7c2d12", marginBottom: 18, fontSize: 20 }}>🚪 Name vom Nachbarn?</h2>
        <input autoFocus value={nachbarName} onChange={e => setNachbarName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && nachbarName.trim()) { updateStatus(nachbarStop, "Beim Nachbarn", nachbarName); setNachbarStop(null); setNachbarName(""); } }}
          placeholder="Nachbar Name"
          style={{ width: "100%", padding: 13, borderRadius: 12, border: "1.5px solid #f3d5d5", fontSize: 15, marginBottom: 14, boxSizing: "border-box", color: "#1c1c1c" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <Btn color="#f97316" onClick={() => { updateStatus(nachbarStop, "Beim Nachbarn", nachbarName); setNachbarStop(null); setNachbarName(""); }}>Bestätigen</Btn>
          <Btn color="#9ca3af" onClick={() => { setNachbarStop(null); setNachbarName(""); }}>Abbrechen</Btn>
        </div>
      </div>
    </main>
  );

  // ── Main ─────────────────────────────────────────────────
  return (
    <main style={S.page}>

      {/* Decorative blobs */}
      <div style={{ position: "fixed", top: 0, left: 0, width: "22rem", height: "22rem", background: "rgba(251,207,207,0.25)", borderRadius: "50%", transform: "translate(-40%,-40%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: 0, right: 0, width: "18rem", height: "18rem", background: "rgba(254,243,199,0.25)", borderRadius: "50%", transform: "translate(30%,30%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Navbar */}
      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="logo" style={S.logo} />
          <div>
            <div style={{ color: "#1c1c1c", fontWeight: "bold", fontSize: 15 }}>{name}</div>
            <div style={{ color: "#9ca3af", fontSize: 12 }}>Dirk Schröder FahrerApp</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if ("Notification" in window) Notification.requestPermission().then(p => { if (p === "granted") notify("Benachrichtigungen aktiv", "Du wirst informiert."); }); }}
            title="Benachrichtigungen" style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "8px 12px", fontSize: 18, cursor: "pointer" }}>🔔</button>
          <button onClick={logout} style={{ background: "#b91c1c", color: "white", border: "none", padding: "8px 16px", borderRadius: 10, fontWeight: "bold", fontSize: 14, cursor: "pointer" }}>Logout</button>
        </div>
      </nav>

      <div style={{ ...S.wrap, position: "relative", zIndex: 1 }}>

        {/* Progress */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ color: "#7c2d12", fontWeight: "bold", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>Fortschritt</span>
            <span style={{ color: "#b91c1c", fontWeight: "bold" }}>{done.length} / {tour.length}</span>
          </div>
          <div style={{ width: "100%", height: 12, background: "#fde8e8", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#b91c1c,#dc2626)", transition: "width 0.5s", borderRadius: 999 }} />
          </div>
        </div>

        {/* Route button */}
        {pending.length > 0 && (
          <button onClick={openAllOnMap} style={{ width: "100%", padding: 14, border: "none", borderRadius: 16, background: "#7c2d12", color: "white", fontWeight: "bold", fontSize: 15, cursor: "pointer", marginBottom: 20, boxShadow: "0 4px 14px rgba(124,45,18,0.2)" }}>
            🗺 Alle {pending.length} Stops als Route öffnen
          </button>
        )}

        {loading && <p style={{ color: "#9ca3af", textAlign: "center", padding: 20 }}>Wird geladen…</p>}

        {/* Pending stops */}
        {pending.map((stop, i) => (
          <div key={stop.id} style={{ ...S.card, borderLeft: "4px solid #b91c1c" }}>
            <div style={S.stopNum}>Stop {i + 1}</div>
            <div style={S.name}>{stop.name}</div>
            {stop.adresse && <div style={S.info}><span>📍</span><span>{stop.adresse}</span></div>}
            {stop.telefon && <a href={`tel:${stop.telefon}`} style={{ ...S.info, color: "#1d4ed8", textDecoration: "none" }}><span>📞</span><span>{stop.telefon}</span></a>}
            {stop.notiz   && <div style={{ ...S.info, color: "#92400e" }}><span>📝</span><span>{stop.notiz}</span></div>}
            <div style={S.btnRow}>
              <Btn color="#1d4ed8" onClick={() => navigateTo(stop.adresse || stop.name || "")}>🧭 Navigieren</Btn>
              <Btn color="#16a34a" onClick={() => updateStatus(stop.id, "Geliefert")}>✅ Geliefert</Btn>
              <Btn color="#ea580c" onClick={() => { setNachbarStop(stop.id); setNachbarName(""); }}>🚪 Nachbar</Btn>
              <Btn color="#0f766e" onClick={() => updateStatus(stop.id, "Vor die Tür")}>🚪 Vor Tür</Btn>
              <Btn color="#dc2626" onClick={() => updateStatus(stop.id, "Falsche Adresse")}>❌ Falsch</Btn>
            </div>
          </div>
        ))}

        {/* Done stops */}
        {done.length > 0 && (
          <>
            <p style={{ color: "#d1b3b3", fontSize: 12, textAlign: "center", margin: "8px 0 12px", letterSpacing: "0.1em" }}>— ERLEDIGT ({done.length}) —</p>
            {done.map(stop => (
              <div key={stop.id} style={{ ...S.card, opacity: 0.65, borderLeft: "4px solid #86efac" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#15803d", fontWeight: "bold", fontSize: 15 }}>✅ {stop.name}</span>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>{stop.deliveredTime}</span>
                </div>
                {stop.adresse && <div style={{ ...S.info, marginTop: 4 }}><span>📍</span><span>{stop.adresse}</span></div>}
                {stop.status !== "Geliefert" && <div style={{ ...S.info, color: "#92400e" }}>{stop.status}{stop.nachbar ? ` — ${stop.nachbar}` : ""}</div>}
              </div>
            ))}
          </>
        )}

        {!loading && tour.length === 0 && (
          <div style={{ textAlign: "center", color: "#d1b3b3", marginTop: 60 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🌸</div>
            <p style={{ fontSize: 16 }}>Keine Stops für heute</p>
          </div>
        )}
      </div>
    </main>
  );
}
