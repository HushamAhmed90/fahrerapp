"use client";

import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useEffect, useState } from "react";

const ADMIN_PASSWORD = "123456";

type Driver = {
  id: string;
  name: string;
  active: boolean;
  password?: string;
};

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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function loginAdmin() {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("driversAdminAllowed", "yes");
      setAllowed(true);
      loadDrivers();
    } else {
      alert("Wrong password");
    }
  }

  function logoutAdmin() {
    localStorage.removeItem("driversAdminAllowed");
    setAllowed(false);
    setPassword("");
  }

  async function loadDrivers() {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "drivers"));
    const list = snapshot.docs.map((item) => ({
      id: item.id,
      name: item.data().name || "",
      active: item.data().active !== false,
      password: item.data().password || "",
    }));
    setDrivers(list);
    setLoading(false);
  }

  async function addDriver() {
    if (!newName.trim()) return;
    await addDoc(collection(db, "drivers"), {
      name: newName.trim(),
      active: true,
      password: newPassword.trim(),
      createdAt: new Date().toISOString(),
    });
    setNewName("");
    setNewPassword("");
    showToast("✅ Fahrer hinzugefügt!");
    loadDrivers();
  }

  async function deleteDriver(id: string) {
    if (!confirm("Fahrer löschen?")) return;
    await deleteDoc(doc(db, "drivers", id));
    showToast("🗑️ Fahrer gelöscht!");
    loadDrivers();
  }

  async function toggleDriver(driver: Driver) {
    await updateDoc(doc(db, "drivers", driver.id), { active: !driver.active });
    showToast(driver.active ? "⛔ Deaktiviert" : "✅ Aktiviert");
    loadDrivers();
  }

  function startEdit(driver: Driver) {
    setEditingId(driver.id);
    setEditName(driver.name);
    setEditPassword(driver.password || "");
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await updateDoc(doc(db, "drivers", id), {
      name: editName.trim(),
      password: editPassword.trim(),
    });
    setEditingId(null);
    showToast("✅ Änderungen gespeichert!");
    loadDrivers();
  }

  useEffect(() => {
    if (localStorage.getItem("driversAdminAllowed") === "yes") {
      setAllowed(true);
      loadDrivers();
    }
  }, []);

  if (!allowed) {
    return (
      <main style={S.main}>
        <div style={S.loginBox}>
          <h1 style={S.loginTitle}>🔐 Admin Login</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loginAdmin()}
            placeholder="Admin Passwort"
            style={S.input}
          />
          <button onClick={loginAdmin} style={{ ...S.btn, ...S.btnGreen, width: "100%", marginTop: 8 }}>
            Login
          </button>
        </div>
      </main>
    );
  }

  const activeCount = drivers.filter((d) => d.active).length;

  return (
    <main style={S.main}>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.container}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h1 style={S.title}>👥 Driver Management</h1>
            <p style={S.subtitle}>{activeCount} aktiv / {drivers.length} gesamt</p>
          </div>
          <button onClick={logoutAdmin} style={{ ...S.btn, ...S.btnRed }}>
            🚪 Logout
          </button>
        </div>

        {/* Add Driver */}
        <div style={S.card}>
          <h2 style={S.cardTitle}>➕ Fahrer hinzufügen</h2>
          <div style={S.row}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              style={S.input}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Passwort"
              style={S.input}
            />
            <button onClick={addDriver} disabled={!newName.trim()} style={{ ...S.btn, ...S.btnBlue }}>
              ➕ Hinzufügen
            </button>
          </div>
        </div>

        {/* Drivers List */}
        <div style={S.card}>
          <h2 style={S.cardTitle}>📋 Fahrerliste</h2>
          {loading ? (
            <p style={{ color: "#64748b" }}>Lädt...</p>
          ) : drivers.length === 0 ? (
            <p style={{ color: "#64748b" }}>Keine Fahrer gefunden.</p>
          ) : (
            drivers.map((driver) => (
              <div key={driver.id} style={{ ...S.driverRow, opacity: driver.active ? 1 : 0.5 }}>

                {editingId === driver.id ? (
                  // Edit Mode
                  <div style={S.editRow}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ ...S.input, flex: 1 }}
                      placeholder="Name"
                    />
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      style={{ ...S.input, flex: 1 }}
                      placeholder="Passwort"
                    />
                    <button onClick={() => saveEdit(driver.id)} style={{ ...S.btn, ...S.btnGreen }}>
                      💾 Speichern
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ ...S.btn, ...S.btnGray }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div style={S.driverInfo}>
                      <div style={S.driverName}>{driver.name}</div>
                      <div style={{ ...S.driverStatus, color: driver.active ? "#22c55e" : "#ef4444" }}>
                        {driver.active ? "● Aktiv" : "● Inaktiv"}
                      </div>
                    </div>
                    <div style={S.driverActions}>
                      <button onClick={() => startEdit(driver)} style={{ ...S.btn, ...S.btnBlue }}>
                        ✏️ Bearbeiten
                      </button>
                      <button onClick={() => toggleDriver(driver)} style={{ ...S.btn, ...(driver.active ? S.btnOrange : S.btnGreen) }}>
                        {driver.active ? "⛔ Deaktivieren" : "✅ Aktivieren"}
                      </button>
                      <button onClick={() => deleteDriver(driver.id)} style={{ ...S.btn, ...S.btnRed }}>
                        🗑️ Löschen
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#020617 0%,#04122b 50%,#020617 100%)",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: 900, margin: "0 auto" },
  loginBox: {
    maxWidth: 400, margin: "100px auto",
    background: "rgba(15,23,42,0.9)",
    padding: 40, borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  loginTitle: { color: "white", fontSize: 28, marginBottom: 24, textAlign: "center" },
  toast: {
    position: "fixed", top: 24, right: 24, zIndex: 9999,
    background: "#14532d", color: "#86efac",
    border: "1px solid #22c55e",
    padding: "14px 20px", borderRadius: 12,
    fontWeight: "bold", fontSize: 14,
  },
  header: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 24,
  },
  title: { color: "white", fontSize: 32, margin: 0 },
  subtitle: { color: "#64748b", fontSize: 14, margin: "4px 0 0" },
  card: {
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 24, padding: 24, marginBottom: 20,
  },
  cardTitle: { color: "white", fontSize: 18, margin: "0 0 16px", fontWeight: "bold" },
  row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
  input: {
    padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)", color: "white",
    fontSize: 14, minWidth: 160,
  },
  driverRow: {
    padding: "16px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  editRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  driverInfo: { marginBottom: 10 },
  driverName: { color: "white", fontSize: 16, fontWeight: "bold" },
  driverStatus: { fontSize: 13, marginTop: 4 },
  driverActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  btn: {
    border: "none", padding: "10px 16px", borderRadius: 10,
    fontWeight: "bold", cursor: "pointer", fontSize: 13,
    transition: "opacity 0.2s",
  },
  btnBlue: { background: "#2563eb", color: "white" },
  btnGreen: { background: "#16a34a", color: "white" },
  btnRed: { background: "#dc2626", color: "white" },
  btnOrange: { background: "#d97706", color: "white" },
  btnGray: { background: "rgba(255,255,255,0.1)", color: "white" },
};
