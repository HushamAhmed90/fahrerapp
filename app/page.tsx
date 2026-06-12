"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
// ❌ خاطئ
import { db } from "../../firebase";

// ✅ صحيح
import { db } from "../firebase";
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
};

const DRIVERS = [
  { name: "mohammed", password: "19901990" },
  { name: "Hisham",   password: "19901990" },
  { name: "Mahmoud",  password: "19901990" },
  { name: "Rainer",   password: "19901990" },
  { name: "Hans",     password: "19901990" },
];

export default function DriverPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [tour, setTour] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("driverName");
    if (saved) {
      setName(saved);
      setLoggedIn(true);
      loadTour(saved);
    }
  }, []);

  async function loadTour(driverName: string) {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "touren"));
    const allStops: Stop[] = [];
    snapshot.forEach((document) => {
      allStops.push({ id: document.id, ...(document.data() as Omit<Stop, "id">) });
    });
    const filtered = allStops.filter(
      (stop) => stop.fahrer?.toLowerCase().trim() === driverName.toLowerCase().trim()
    );
    setTour(filtered);
    setLoading(false);
  }

  async function updateStatus(stopId: string, status: string, nachbar: string = "") {
    const now = new Date();
    await updateDoc(doc(db, "touren", stopId), {
      status,
      nachbar,
      deliveredDate: now.toLocaleDateString("de-DE"),
      deliveredTime: now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      updatedAt: now.toISOString(),
    });
    await loadTour(name);
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

  const deliveredCount = tour.filter((s) => s.status === "Geliefert").length;
  const progress = tour.length > 0 ? (deliveredCount / tour.length) * 100 : 0;
  const sortedTour = [...tour].sort((a, b) => {
    if (!a.status && b.status) return -1;
    if (a.status && !b.status) return 1;
    return 0;
  });

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
      <div style={{ maxWidth: 950, margin: "0 auto" }}>
        <img src="/logo.png" alt="logo" style={{ width: 150, borderRadius: 22, marginBottom: 20 }} />
        <h1 style={{ color: "white", marginBottom: 8 }}>Willkommen {name}</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>Dirk Schröder FahrerApp</p>
        <button onClick={logout} style={{ background: "#dc2626", color: "white", border: "none", padding: "12px 20px", borderRadius: 12, marginBottom: 25, fontWeight: "bold", cursor: "pointer" }}>
          Logout
        </button>

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

        {sortedTour.map((stop, index) => (
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
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.adresse || stop.name || "")}`}
                target="_blank"
                style={{ background: "#2563eb", color: "white", textDecoration: "none", padding: "10px 14px", borderRadius: 10, fontWeight: "bold" }}
              >
                Google Maps
              </a>
              <button onClick={() => updateStatus(stop.id, "Geliefert")} style={{ background: "#22c55e", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}>
                Geliefert
              </button>
              <button
                onClick={() => {
                  const nachbar = prompt("Name vom Nachbarn?");
                  updateStatus(stop.id, "Beim Nachbarn", nachbar || "");
                }}
                style={{ background: "#f97316", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
              >
                Nachbar
              </button>
              <button onClick={() => updateStatus(stop.id, "Vor die Tür")} style={{ background: "#0f766e", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}>
                Vor die Tür
              </button>
              <button onClick={() => updateStatus(stop.id, "Falsche Adresse")} style={{ background: "#dc2626", color: "white", border: "none", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}>
                Falsche Adresse
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
