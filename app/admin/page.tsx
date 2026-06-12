"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  query, where, getDocs, onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";

type Driver = { id: string; name: string; active: boolean };
type Stop = {
  id: string; name: string; adresse: string;
  telefon?: string; notiz?: string; fahrer: string;
  status: string; deliveredDate?: string; deliveredTime?: string;
};
type StatusFilter = "" | "Geliefert" | "Beim Nachbarn" | "Vor die Tür" | "Falsche Adresse";
type Toast = { id: number; message: string; type: "success" | "error" };

const tulpenSVG = `<svg xmlns="http://www.w3.org/2000/svg" style="position:fixed;top:0;left:0;width:100%;height:100%;opacity:0.06;pointer-events:none;z-index:0;" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
  <ellipse cx="50" cy="90" rx="22" ry="34" fill="#c08878" transform="rotate(-12 50 90)"/>
  <ellipse cx="34" cy="102" rx="17" ry="27" fill="#a06858" transform="rotate(-25 34 102)"/>
  <ellipse cx="66" cy="102" rx="17" ry="27" fill="#a06858" transform="rotate(25 66 102)"/>
  <rect x="48" y="122" width="5" height="80" fill="#6a8a60" rx="2"/>
  <ellipse cx="36" cy="178" rx="18" ry="7" fill="#6a8a60" transform="rotate(-30 36 178)"/>
  <ellipse cx="360" cy="70" rx="20" ry="32" fill="#d4a0a0" transform="rotate(10 360 70)"/>
  <ellipse cx="345" cy="82" rx="15" ry="25" fill="#b07878" transform="rotate(-18 345 82)"/>
  <ellipse cx="375" cy="82" rx="15" ry="25" fill="#b07878" transform="rotate(18 375 82)"/>
  <rect x="358" y="100" width="5" height="80" fill="#6a8a60" rx="2"/>
  <ellipse cx="30" cy="420" rx="16" ry="26" fill="#d4a0a0" transform="rotate(-8 30 420)"/>
  <ellipse cx="18" cy="432" rx="12" ry="20" fill="#b07878" transform="rotate(-22 18 432)"/>
  <ellipse cx="42" cy="432" rx="12" ry="20" fill="#b07878" transform="rotate(22 42 432)"/>
  <rect x="28" y="445" width="4" height="65" fill="#6a8a60" rx="2"/>
  <ellipse cx="375" cy="400" rx="15" ry="24" fill="#c08878" transform="rotate(8 375 400)"/>
  <ellipse cx="363" cy="412" rx="11" ry="18" fill="#a06858" transform="rotate(-16 363 412)"/>
  <ellipse cx="387" cy="412" rx="11" ry="18" fill="#a06858" transform="rotate(16 387 412)"/>
  <rect x="373" y="422" width="4" height="60" fill="#6a8a60" rx="2"/>
  <ellipse cx="40" cy="780" rx="18" ry="28" fill="#d4a0a0" transform="rotate(-10 40 780)"/>
  <ellipse cx="26" cy="792" rx="14" ry="22" fill="#b07878" transform="rotate(-24 26 792)"/>
  <ellipse cx="54" cy="792" rx="14" ry="22" fill="#b07878" transform="rotate(24 54 792)"/>
  <rect x="38" y="806" width="4" height="70" fill="#6a8a60" rx="2"/>
  <ellipse cx="365" cy="800" rx="18" ry="28" fill="#c08878" transform="rotate(10 365 800)"/>
  <ellipse cx="351" cy="812" rx="14" ry="22" fill="#a06858" transform="rotate(-20 351 812)"/>
  <ellipse cx="379" cy="812" rx="14" ry="22" fill="#a06858" transform="rotate(20 379 812)"/>
  <rect x="363" y="826" width="4" height="65" fill="#6a8a60" rx="2"/>
</svg>`;

export default function AdminPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [tour, setTour] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDriver, setFilterDriver] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  useEffect(() => {
    async function loadDrivers() {
      try {
        const snapshot = await getDocs(collection(db, "drivers"));
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Driver, "id">) })).filter((d) => d.active);
        setDrivers(list);
        if (list.length > 0) setSelectedDriver(list[0].name);
      } catch { showToast("Fahrer konnten nicht geladen werden.", "error"); }
    }
    loadDrivers();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "touren"),
      (snapshot) => { setTour(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Stop, "id">) }))); },
      () => showToast("Verbindungsfehler", "error")
    );
    return () => unsubscribe();
  }, []);

  const filteredTour = useMemo(() => tour.filter((stop) => {
    const matchesSearch = search === "" || stop.name?.toLowerCase().includes(search.toLowerCase()) || stop.adresse?.toLowerCase().includes(search.toLowerCase());
    const matchesDriver = filterDriver === "all" || stop.fahrer === filterDriver;
    const matchesDate = filterDate === "" || stop.deliveredDate === filterDate;
    return matchesSearch && matchesDriver && matchesDate;
  }), [tour, search, filterDriver, filterDate]);

  const stats = useMemo(() => ({
    total: tour.length,
    pending: tour.filter((s) => !s.status).length,
    delivered: tour.filter((s) => s.status === "Geliefert").length,
    neighbor: tour.filter((s) => s.status === "Beim Nachbarn").length,
    door: tour.filter((s) => s.status === "Vor die Tür").length,
    wrong: tour.filter((s) => s.status === "Falsche Adresse").length,
  }), [tour]);

  const completionPercent = stats.total > 0 ? Math.round(((stats.total - stats.pending) / stats.total) * 100) : 0;

  async function uploadPDF() {
    if (!file) { showToast("Bitte PDF wählen", "error"); return; }
    if (!selectedDriver) { showToast("Bitte Fahrer auswählen", "error"); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/read-tour", { method: "POST", body: formData });
      const result = await response.json();
      if (!result.success) { showToast(result.error ?? "Fehler", "error"); return; }
      await Promise.all(result.data.map((item: Partial<Stop>) =>
        addDoc(collection(db, "touren"), { name: item.name ?? "", adresse: item.adresse ?? "", telefon: item.telefon ?? "", notiz: item.notiz ?? "", fahrer: selectedDriver, status: "", deliveredDate: "", deliveredTime: "" })
      ));
      showToast("Tour erfolgreich importiert ✅");
      setFile(null);
    } catch { showToast("Fehler beim PDF-Upload", "error"); }
    finally { setLoading(false); }
  }

  async function deletePlan() {
    if (!selectedDriver) return;
    if (!confirm(`Plan von ${selectedDriver} löschen?`)) return;
    setDeletingPlan(true);
    try {
      const q = query(collection(db, "touren"), where("fahrer", "==", selectedDriver));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, "touren", d.id))));
      showToast(`Plan von ${selectedDriver} gelöscht ✅`);
    } catch { showToast("Fehler beim Löschen", "error"); }
    finally { setDeletingPlan(false); }
  }

  async function resetStatuses() {
    if (!confirm("Status aller Stopps zurücksetzen?")) return;
    setResetting(true);
    try {
      const snapshot = await getDocs(collection(db, "touren"));
      await Promise.all(snapshot.docs.map((d) => updateDoc(doc(db, "touren", d.id), { status: "", deliveredDate: "", deliveredTime: "" })));
      showToast("Status erfolgreich zurückgesetzt ✅");
    } catch { showToast("Fehler beim Zurücksetzen", "error"); }
    finally { setResetting(false); }
  }

  function exportCSV() {
    const headers = ["Name", "Adresse", "Telefon", "Fahrer", "Status", "Datum", "Zeit"];
    const rows = filteredTour.map((s) => [s.name, s.adresse, s.telefon ?? "", s.fahrer, s.status, s.deliveredDate ?? "", s.deliveredTime ?? ""]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tour-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("Export erfolgreich ✅");
  }

  const sections: { title: string; status: StatusFilter; color: string }[] = [
    { title: "⏳ Offen", status: "", color: "#b07830" },
    { title: "✅ Geliefert", status: "Geliefert", color: "#3a7a50" },
    { title: "🏠 Beim Nachbarn", status: "Beim Nachbarn", color: "#9a6030" },
    { title: "🚪 Vor die Tür", status: "Vor die Tür", color: "#4a6a9a" },
    { title: "❌ Falsche Adresse", status: "Falsche Adresse", color: "#9a4a4a" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#fdf6f0", padding: 24, fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div dangerouslySetInnerHTML={{ __html: tulpenSVG }} />

      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Logo + Header */}
        <div style={{ textAlign: "center", marginBottom: 28, paddingBottom: 20, borderBottom: "0.5px solid #e8c8c0" }}>
          <img src="/logo.png" alt="Dirk Schröder" style={{ width: 90, height: 90, objectFit: "contain", borderRadius: "50%" }} />
          <p style={{ color: "#2c1a1a", fontSize: 22, fontWeight: 500, margin: "6px 0 0", fontFamily: "Georgia, serif" }}>Dirk Schröder</p>
          <p style={{ color: "#b07878", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", margin: "4px 0 0" }}>· Admin Dashboard ·</p>
        </div>

        {/* Toasts */}
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
          {toasts.map((t) => (
            <div key={t.id} style={{ padding: "14px 20px", borderRadius: 12, fontWeight: "bold", fontSize: 14, minWidth: 260, background: t.type === "error" ? "#f5dddd" : "#ddf0e0", color: t.type === "error" ? "#9a4a4a" : "#3a7a50", border: `0.5px solid ${t.type === "error" ? "#e0b8b0" : "#a8c8a0"}` }}>
              {t.message}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Gesamt", value: stats.total, color: "#8a7070" },
            { label: "Offen", value: stats.pending, color: "#b07830" },
            { label: "Geliefert", value: stats.delivered, color: "#3a7a50" },
            { label: "Nachbar", value: stats.neighbor, color: "#9a6030" },
            { label: "Falsch", value: stats.wrong, color: "#9a4a4a" },
          ].map((stat) => (
            <div key={stat.label} style={{ flex: 1, minWidth: 110, background: "#fff8f5", border: "0.5px solid #e0b8b0", borderRadius: 16, padding: "18px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 36, fontWeight: 500, margin: 0, color: stat.color, fontFamily: "Georgia, serif" }}>{stat.value}</p>
              <p style={{ color: "#b07878", fontSize: 11, margin: "6px 0 0", textTransform: "uppercase", letterSpacing: 1 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Progress */}
        {stats.total > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ height: 8, background: "#f0ddd8", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", background: "#c08878", borderRadius: 999, width: `${completionPercent}%`, transition: "width 0.6s ease" }} />
            </div>
            <p style={{ color: "#b07878", fontSize: 12, margin: 0, textAlign: "right" }}>{completionPercent}% abgeschlossen</p>
          </div>
        )}

        {/* Upload Card */}
        <div style={{ background: "#fff8f5", padding: 28, borderRadius: 20, marginBottom: 24, border: "0.5px solid #e0b8b0" }}>
          <h1 style={{ color: "#2c1a1a", fontSize: 24, margin: "0 0 20px", fontFamily: "Georgia, serif", fontWeight: 500 }}>Tour Upload</h1>
          <label style={{ display: "block", color: "#b07878", fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Fahrer auswählen</label>
          <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} style={{ width: 300, padding: "10px 14px", borderRadius: 10, background: "#fdf6f0", border: "0.5px solid #d4a8a8", color: "#2c1a1a", fontSize: 14 }}>
            <option value="">– Fahrer wählen –</option>
            {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <label style={{ display: "block", color: "#b07878", fontSize: 11, margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>PDF-Datei</label>
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "block", marginBottom: 4, color: "#8a7070" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button onClick={uploadPDF} disabled={loading || !file || !selectedDriver} style={{ background: "#dde8f5", color: "#4a6a9a", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: "bold", cursor: "pointer", fontSize: 13, opacity: loading ? 0.6 : 1 }}>
              {loading ? "⏳ Lädt…" : "📄 PDF lesen"}
            </button>
            <button onClick={resetStatuses} disabled={resetting} style={{ background: "#ddf0e0", color: "#3a7a50", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: "bold", cursor: "pointer", fontSize: 13, opacity: resetting ? 0.6 : 1 }}>
              {resetting ? "⏳ Lädt…" : "🔄 Status zurücksetzen"}
            </button>
            <button onClick={deletePlan} disabled={deletingPlan || !selectedDriver} style={{ background: "#f5dddd", color: "#9a4a4a", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: "bold", cursor: "pointer", fontSize: 13, opacity: deletingPlan ? 0.6 : 1 }}>
              {deletingPlan ? "⏳ Löscht…" : "🗑️ Plan löschen"}
            </button>
            <button onClick={exportCSV} style={{ background: "#f0eaf5", color: "#8a5a9a", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: "bold", cursor: "pointer", fontSize: 13 }}>
              📤 CSV Export
            </button>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="🔍 Name oder Adresse suchen…" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 2, minWidth: 200, padding: "10px 14px", borderRadius: 10, background: "#fff8f5", border: "0.5px solid #d4a8a8", color: "#2c1a1a", fontSize: 14 }} />
          <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)}
            style={{ flex: 1, minWidth: 150, padding: "10px 14px", borderRadius: 10, background: "#fff8f5", border: "0.5px solid #d4a8a8", color: "#2c1a1a", fontSize: 14 }}>
            <option value="all">Alle Fahrer</option>
            {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
            style={{ flex: 1, minWidth: 150, padding: "10px 14px", borderRadius: 10, background: "#fff8f5", border: "0.5px solid #d4a8a8", color: "#2c1a1a", fontSize: 14 }} />
          {(search || filterDriver !== "all" || filterDate) && (
            <button onClick={() => { setSearch(""); setFilterDriver("all"); setFilterDate(""); }}
              style={{ background: "#f5e8e0", color: "#b07878", border: "0.5px solid #d4a8a8", borderRadius: 10, padding: "10px 16px", fontWeight: "bold", cursor: "pointer", fontSize: 13 }}>
              ✕ Reset
            </button>
          )}
        </div>

        {/* Sections */}
        {sections.map(({ title, status, color }) => {
          const items = filteredTour.filter((s) => s.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} style={{ marginBottom: 28 }}>
              <h2 style={{ color, fontSize: 18, margin: "0 0 14px", fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
                {title}
                <span style={{ background: "#fff8f5", color: "#8a7070", fontSize: 12, borderRadius: 999, padding: "2px 12px", border: "0.5px solid #e0b8b0" }}>{items.length}</span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {items.map((stop) => (
                  <div key={stop.id} style={{ background: "#fff8f5", padding: 18, borderRadius: 14, border: `0.5px solid ${color}` }}>
                    <p style={{ color: "#2c1a1a", margin: "0 0 8px", fontSize: 15, fontWeight: 500, fontFamily: "Georgia, serif" }}>{stop.name}</p>
                    <p style={{ color: "#8a7070", margin: "3px 0", fontSize: 13 }}>📍 {stop.adresse}</p>
                    {stop.telefon && <p style={{ color: "#8a7070", margin: "3px 0", fontSize: 13 }}>📞 {stop.telefon}</p>}
                    {stop.notiz && <p style={{ color: "#8a7070", margin: "3px 0", fontSize: 13 }}>📝 {stop.notiz}</p>}
                    <p style={{ color, margin: "8px 0 0", fontSize: 13, fontWeight: 500 }}>🚚 {stop.fahrer}</p>
                    {stop.deliveredDate && <p style={{ color: "#3a7a50", margin: "3px 0", fontSize: 13 }}>📅 {stop.deliveredDate} {stop.deliveredTime}</p>}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {filteredTour.length === 0 && tour.length > 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#8a7070", fontSize: 16 }}>Keine Ergebnisse gefunden</p>
            <button onClick={() => { setSearch(""); setFilterDriver("all"); setFilterDate(""); }}
              style={{ background: "#f5e8e0", color: "#b07878", border: "0.5px solid #d4a8a8", borderRadius: 10, padding: "10px 18px", fontWeight: "bold", cursor: "pointer", fontSize: 13, marginTop: 12 }}>
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
