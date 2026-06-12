"use client";

import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useEffect, useState } from "react";

const ADMIN_PASSWORD = "123456";

type Driver = { id: string; name: string; active: boolean; password?: string };

const tulpenSVG = `<svg xmlns="http://www.w3.org/2000/svg" style="position:fixed;top:0;left:0;width:100%;height:100%;opacity:0.06;pointer-events:none;z-index:0;" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
  <ellipse cx="50" cy="90" rx="22" ry="34" fill="#c08878" transform="rotate(-12 50 90)"/>
  <ellipse cx="34" cy="102" rx="17" ry="27" fill="#a06858" transform="rotate(-25 34 102)"/>
  <ellipse cx="66" cy="102" rx="17" ry="27" fill="#a06858" transform="rotate(25 66 102)"/>
  <rect x="48" y="122" width="5" height="80" fill="#6a8a60" rx="2"/>
  <ellipse cx="360" cy="70" rx="20" ry="32" fill="#d4a0a0" transform="rotate(10 360 70)"/>
  <ellipse cx="345" cy="82" rx="15" ry="25" fill="#b07878" transform="rotate(-18 345 82)"/>
  <ellipse cx="375" cy="82" rx="15" ry="25" fill="#b07878" transform="rotate(18 375 82)"/>
  <rect x="358" y="100" width="5" height="80" fill="#6a8a60" rx="2"/>
  <ellipse cx="30" cy="420" rx="16" ry="26" fill="#d4a0a0" transform="rotate(-8 30 420)"/>
  <ellipse cx="42" cy="432" rx="12" ry="20" fill="#b07878" transform="rotate(22 42 432)"/>
  <rect x="28" y="445" width="4" height="65" fill="#6a8a60" rx="2"/>
  <ellipse cx="375" cy="400" rx="15" ry="24" fill="#c08878" transform="rotate(8 375 400)"/>
  <ellipse cx="387" cy="412" rx="11" ry="18" fill="#a06858" transform="rotate(16 387 412)"/>
  <rect x="373" y="422" width="4" height="60" fill="#6a8a60" rx="2"/>
  <ellipse cx="40" cy="780" rx="18" ry="28" fill="#d4a0a0" transform="rotate(-10 40 780)"/>
  <ellipse cx="54" cy="792" rx="14" ry="22" fill="#b07878" transform="rotate(24 54 792)"/>
  <rect x="38" y="806" width="4" height="70" fill="#6a8a60" rx="2"/>
  <ellipse cx="365" cy="800" rx="18" ry="28" fill="#c08878" transform="rotate(10 365 800)"/>
  <ellipse cx="379" cy="812" rx="14" ry="22" fill="#a06858" transform="rotate(20 379 812)"/>
  <rect x="363" y="826" width="4" height="65" fill="#6a8a60" rx="2"/>
</svg>`;

const inp: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "0.5px solid #d4a8a8", background: "#fdf6f0", color: "#2c1a1a", fontSize: 14, minWidth: 160 };
const card: React.CSSProperties = { background: "#fff8f5", border: "0.5px solid #e0b8b0", borderRadius: 18, padding: 24, marginBottom: 18 };
const btn = (bg: string, color: string): React.CSSProperties => ({ background: bg, color, border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: "bold", cursor: "pointer", fontSize: 13 });

export default function DriversAdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function loginAdmin() {
    if (password === ADMIN_PASSWORD) { localStorage.setItem("driversAdminAllowed", "yes"); setAllowed(true); loadDrivers(); }
    else alert("Wrong password");
  }

  function logoutAdmin() { localStorage.removeItem("driversAdminAllowed"); setAllowed(false); setPassword(""); }

  async function loadDrivers() {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "drivers"));
    setDrivers(snapshot.docs.map((item) => ({ id: item.id, name: item.data().name || "", active: item.data().active !== false, password: item.data().password || "" })));
    setLoading(false);
  }

  async function addDriver() {
    if (!newName.trim()) return;
    await addDoc(collection(db, "drivers"), { name: newName.trim(), active: true, password: newPassword.trim(), createdAt: new Date().toISOString() });
    setNewName(""); setNewPassword("");
    showToast("✅ Fahrer hinzugefügt!"); loadDrivers();
  }

  async function deleteDriver(id: string) {
    if (!confirm("Fahrer löschen?")) return;
    await deleteDoc(doc(db, "drivers", id));
    showToast("🗑️ Fahrer gelöscht!"); loadDrivers();
  }

  async function toggleDriver(driver: Driver) {
    await updateDoc(doc(db, "drivers", driver.id), { active: !driver.active });
    showToast(driver.active ? "⛔ Deaktiviert" : "✅ Aktiviert"); loadDrivers();
  }

  function startEdit(driver: Driver) { setEditingId(driver.id); setEditName(driver.name); setEditPassword(driver.password || ""); }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await updateDoc(doc(db, "drivers", id), { name: editName.trim(), password: editPassword.trim() });
    setEditingId(null); showToast("✅ Änderungen gespeichert!"); loadDrivers();
  }

  useEffect(() => {
    if (localStorage.getItem("driversAdminAllowed") === "yes") { setAllowed(true); loadDrivers(); }
  }, []);

  if (!allowed) {
    return (
      <main style={{ minHeight: "100vh", background: "#fdf6f0", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
        <div dangerouslySetInnerHTML={{ __html: tulpenSVG }} />
        <div style={{ ...card, maxWidth: 400, width: "100%", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <img src="/logo.png" alt="Dirk Schröder" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: "50%" }} />
            <p style={{ color: "#2c1a1a", fontSize: 20, fontWeight: 500, margin: "8px 0 0", fontFamily: "Georgia, serif" }}>Dirk Schröder</p>
            <p style={{ color: "#b07878", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", margin: "4px 0 0" }}>· Driver Management ·</p>
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginAdmin()} placeholder="Admin Passwort" style={{ ...inp, width: "100%", marginBottom: 12, boxSizing: "border-box" }} />
          <button onClick={loginAdmin} style={{ ...btn("#c08878", "white"), width: "100%", padding: "12px" }}>Login</button>
        </div>
      </main>
    );
  }

  const activeCount = drivers.filter((d) => d.active).length;

  return (
    <main style={{ minHeight: "100vh", background: "#fdf6f0", padding: 24, fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div dangerouslySetInnerHTML={{ __html: tulpenSVG }} />

      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, background: "#ddf0e0", color: "#3a7a50", border: "0.5px solid #a8c8a0", padding: "14px 20px", borderRadius: 12, fontWeight: "bold", fontSize: 14 }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28, paddingBottom: 20, borderBottom: "0.5px solid #e8c8c0" }}>
          <img src="/logo.png" alt="Dirk Schröder" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: "50%" }} />
          <p style={{ color: "#2c1a1a", fontSize: 20, fontWeight: 500, margin: "6px 0 0", fontFamily: "Georgia, serif" }}>Dirk Schröder</p>
          <p style={{ color: "#b07878", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", margin: "4px 0 0" }}>· Driver Management ·</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ color: "#8a7070", fontSize: 14, margin: 0 }}>{activeCount} aktiv / {drivers.length} gesamt</p>
          <button onClick={logoutAdmin} style={btn("#f5dddd", "#9a4a4a")}>🚪 Logout</button>
        </div>

        {/* Add Driver */}
        <div style={card}>
          <h2 style={{ color: "#2c1a1a", fontSize: 18, margin: "0 0 16px", fontWeight: 500, fontFamily: "Georgia, serif" }}>Fahrer hinzufügen</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" style={inp} />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Passwort" style={inp} />
            <button onClick={addDriver} disabled={!newName.trim()} style={btn("#dde8f5", "#4a6a9a")}>➕ Hinzufügen</button>
          </div>
        </div>

        {/* Drivers List */}
        <div style={card}>
          <h2 style={{ color: "#2c1a1a", fontSize: 18, margin: "0 0 16px", fontWeight: 500, fontFamily: "Georgia, serif" }}>Fahrerliste</h2>
          {loading ? (
            <p style={{ color: "#8a7070" }}>Lädt...</p>
          ) : drivers.length === 0 ? (
            <p style={{ color: "#8a7070" }}>Keine Fahrer gefunden.</p>
          ) : drivers.map((driver) => (
            <div key={driver.id} style={{ padding: "14px 0", borderBottom: "0.5px solid #e8d0c8", opacity: driver.active ? 1 : 0.55 }}>
              {editingId === driver.id ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inp, flex: 1 }} placeholder="Name" />
                  <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} style={{ ...inp, flex: 1 }} placeholder="Passwort" />
                  <button onClick={() => saveEdit(driver.id)} style={btn("#ddf0e0", "#3a7a50")}>💾 Speichern</button>
                  <button onClick={() => setEditingId(null)} style={btn("#f5e8e0", "#b07878")}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <p style={{ color: "#2c1a1a", fontSize: 15, fontWeight: 500, margin: 0, fontFamily: "Georgia, serif" }}>{driver.name}</p>
                    <p style={{ color: driver.active ? "#3a7a50" : "#9a4a4a", fontSize: 12, margin: "4px 0 0" }}>{driver.active ? "● Aktiv" : "● Inaktiv"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => startEdit(driver)} style={btn("#dde8f5", "#4a6a9a")}>✏️ Bearbeiten</button>
                    <button onClick={() => toggleDriver(driver)} style={driver.active ? btn("#fdeedd", "#9a6030") : btn("#ddf0e0", "#3a7a50")}>
                      {driver.active ? "⛔ Deaktivieren" : "✅ Aktivieren"}
                    </button>
                    <button onClick={() => deleteDriver(driver.id)} style={btn("#f5dddd", "#9a4a4a")}>🗑️ Löschen</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
