"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Driver = { id: string; name: string; active: boolean };

type Stop = {
  id: string;
  name: string;
  adresse: string;
  telefon?: string;
  notiz?: string;
  fahrer: string;
  status: string;
  deliveredDate?: string;
  deliveredTime?: string;
};

type StatusFilter = "" | "Geliefert" | "Beim Nachbarn" | "Vor die Tür" | "Falsche Adresse";
type Toast = { id: number; message: string; type: "success" | "error" };

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ─── Toast System ─────────────────────────────────────────────────────────

  function showToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  // ─── Load Drivers ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadDrivers() {
      try {
        const snapshot = await getDocs(collection(db, "drivers"));
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Driver, "id">) }))
          .filter((d) => d.active);
        setDrivers(list);
        if (list.length > 0) setSelectedDriver(list[0].name);
      } catch {
        showToast("Fahrer konnten nicht geladen werden.", "error");
      }
    }
    loadDrivers();
  }, []);

  // ─── Real-time Tour (onSnapshot) ─────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "touren"),
      (snapshot) => {
        const allStops: Stop[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Stop, "id">),
        }));
        setTour(allStops);
      },
      () => showToast("Verbindungsfehler", "error")
    );
    return () => unsubscribe();
  }, []);

  // ─── Filtered Tour ────────────────────────────────────────────────────────

  const filteredTour = useMemo(() => {
    return tour.filter((stop) => {
      const matchesSearch =
        search === "" ||
        stop.name?.toLowerCase().includes(search.toLowerCase()) ||
        stop.adresse?.toLowerCase().includes(search.toLowerCase());
      const matchesDriver = filterDriver === "all" || stop.fahrer === filterDriver;
      const matchesDate = filterDate === "" || stop.deliveredDate === filterDate;
      return matchesSearch && matchesDriver && matchesDate;
    });
  }, [tour, search, filterDriver, filterDate]);

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: tour.length,
    pending: tour.filter((s) => !s.status).length,
    delivered: tour.filter((s) => s.status === "Geliefert").length,
    neighbor: tour.filter((s) => s.status === "Beim Nachbarn").length,
    door: tour.filter((s) => s.status === "Vor die Tür").length,
    wrong: tour.filter((s) => s.status === "Falsche Adresse").length,
  }), [tour]);

  const completionPercent =
    stats.total > 0
      ? Math.round(((stats.total - stats.pending) / stats.total) * 100)
      : 0;

  // ─── Upload PDF ───────────────────────────────────────────────────────────

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
      await Promise.all(
        result.data.map((item: Partial<Stop>) =>
          addDoc(collection(db, "touren"), {
            name: item.name ?? "", adresse: item.adresse ?? "",
            telefon: item.telefon ?? "", notiz: item.notiz ?? "",
            fahrer: selectedDriver, status: "",
            deliveredDate: "", deliveredTime: "",
          })
        )
      );
      showToast("Tour erfolgreich importiert ✅");
      setFile(null);
    } catch {
      showToast("Fehler beim PDF-Upload", "error");
    } finally {
      setLoading(false);
    }
  }

  // ─── Delete Plan ──────────────────────────────────────────────────────────

  async function deletePlan() {
    if (!selectedDriver) return;
    if (!confirm(`Plan von ${selectedDriver} löschen?`)) return;
    setDeletingPlan(true);
    try {
      const q = query(collection(db, "touren"), where("fahrer", "==", selectedDriver));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, "touren", d.id))));
      showToast(`Plan von ${selectedDriver} gelöscht ✅`);
    } catch {
      showToast("Fehler beim Löschen", "error");
    } finally {
      setDeletingPlan(false);
    }
  }

  // ─── Reset Statuses ───────────────────────────────────────────────────────

  async function resetStatuses() {
    if (!confirm("Status aller Stopps zurücksetzen?")) return;
    setResetting(true);
    try {
      const snapshot = await getDocs(collection(db, "touren"));
      await Promise.all(
        snapshot.docs.map((d) =>
          updateDoc(doc(db, "touren", d.id), {
            status: "", deliveredDate: "", deliveredTime: "",
          })
        )
      );
      showToast("Status erfolgreich zurückgesetzt ✅");
    } catch {
      showToast("Fehler beim Zurücksetzen", "error");
    } finally {
      setResetting(false);
    }
  }

  // ─── Export CSV ───────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = ["Name", "Adresse", "Telefon", "Fahrer", "Status", "Datum", "Zeit"];
    const rows = filteredTour.map((s) => [
      s.name, s.adresse, s.telefon ?? "", s.fahrer,
      s.status, s.deliveredDate ?? "", s.deliveredTime ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tour-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export erfolgreich ✅");
  }

  // ─── Sections ─────────────────────────────────────────────────────────────

  const sections: { title: string; status: StatusFilter; color: string }[] = [
    { title: "⏳ Offen", status: "", color: "#facc15" },
    { title: "✅ Geliefert", status: "Geliefert", color: "#22c55e" },
    { title: "🏠 Beim Nachbarn", status: "Beim Nachbarn", color: "#f97316" },
    { title: "🚪 Vor die Tür", status: "Vor die Tür", color: "#3b82f6" },
    { title: "❌ Falsche Adresse", status: "Falsche Adresse", color: "#ef4444" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main style={S.main}>
      <div style={S.container}>

        {/* Logo */}
        <img src="/logo.png" alt="logo" style={S.logo} />

        {/* Toast Notifications */}
        <div style={S.toastContainer}>
          {toasts.map((t) => (
            <div key={t.id} style={{ ...S.toast, ...(t.type === "error" ? S.toastError : S.toastSuccess) }}>
              {t.message}
            </div>
          ))}
        </div>

        {/* ── Stats Cards ── */}
        <div style={S.statsRow}>
          {[
            { label: "Gesamt", value: stats.total, color: "#94a3b8" },
            { label: "Offen", value: stats.pending, color: "#facc15" },
            { label: "Geliefert", value: stats.delivered, color: "#22c55e" },
            { label: "Nachbar", value: stats.neighbor, color: "#f97316" },
            { label: "Falsch", value: stats.wrong, color: "#ef4444" },
          ].map((stat) => (
            <div key={stat.label} style={S.statCard}>
              <p style={{ ...S.statValue, color: stat.color }}>{stat.value}</p>
              <p style={S.statLabel}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Progress Bar ── */}
        {stats.total > 0 && (
          <div style={S.progressWrapper}>
            <div style={S.progressBar}>
              <div style={{ ...S.progressFill, width: `${completionPercent}%` }} />
            </div>
            <p style={S.progressText}>{completionPercent}% abgeschlossen</p>
          </div>
        )}

        {/* ── Upload Panel ── */}
        <div style={S.card}>
          <h1 style={S.heading}>Tour Upload</h1>

          <label style={S.label}>Fahrer auswählen</label>
          <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} style={S.select}>
            <option value="">– Fahrer wählen –</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>

          <label style={S.label}>PDF-Datei</label>
          <input
            type="file" accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={S.fileInput}
          />

          <div style={S.buttonRow}>
            <button onClick={uploadPDF} disabled={loading || !file || !selectedDriver}
              style={{ ...S.btn, ...S.btnBlue, opacity: loading ? 0.6 : 1 }}>
              {loading ? "⏳ Lädt…" : "📄 PDF lesen"}
            </button>
            <button onClick={resetStatuses} disabled={resetting}
              style={{ ...S.btn, ...S.btnGreen, opacity: resetting ? 0.6 : 1 }}>
              {resetting ? "⏳ Lädt…" : "🔄 Status zurücksetzen"}
            </button>
            <button onClick={deletePlan} disabled={deletingPlan || !selectedDriver}
              style={{ ...S.btn, ...S.btnRed, opacity: deletingPlan ? 0.6 : 1 }}>
              {deletingPlan ? "⏳ Löscht…" : "🗑️ Plan löschen"}
            </button>
            <button onClick={exportCSV} style={{ ...S.btn, ...S.btnGray }}>
              📤 CSV Export
            </button>
          </div>
        </div>

        {/* ── Search & Filter ── */}
        <div style={S.filterRow}>
          <input
            type="text"
            placeholder="🔍 Name oder Adresse suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={S.searchInput}
          />
          <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} style={S.filterSelect}>
            <option value="all">Alle Fahrer</option>
            {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <input
            type="date" value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={S.dateInput}
          />
          {(search || filterDriver !== "all" || filterDate) && (
            <button
              onClick={() => { setSearch(""); setFilterDriver("all"); setFilterDate(""); }}
              style={{ ...S.btn, ...S.btnGray }}>
              ✕ Reset
            </button>
          )}
        </div>

        {/* ── Tour Sections ── */}
        {sections.map(({ title, status, color }) => {
          const items = filteredTour.filter((s) => s.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} style={S.section}>
              <h2 style={{ ...S.sectionTitle, color }}>
                {title} <span style={S.badge}>{items.length}</span>
              </h2>
              <div style={S.grid}>
                {items.map((stop) => (
                  <div key={stop.id} style={{ ...S.stopCard, borderColor: color }}>
                    <h3 style={S.stopName}>{stop.name}</h3>
                    <p style={S.stopDetail}>📍 {stop.adresse}</p>
                    {stop.telefon && <p style={S.stopDetail}>📞 {stop.telefon}</p>}
                    {stop.notiz && <p style={S.stopDetail}>📝 {stop.notiz}</p>}
                    <p style={{ ...S.stopDetail, color, fontWeight: "bold", marginTop: 8 }}>
                      🚚 {stop.fahrer}
                    </p>
                    {stop.deliveredDate && (
                      <p style={{ ...S.stopDetail, color: "#86efac" }}>📅 {stop.deliveredDate}</p>
                    )}
                    {stop.deliveredTime && (
                      <p style={{ ...S.stopDetail, color: "#86efac" }}>⏰ {stop.deliveredTime}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* ── Empty State ── */}
        {filteredTour.length === 0 && tour.length > 0 && (
          <div style={S.emptyState}>
            <p style={{ color: "#475569", fontSize: 18 }}>Keine Ergebnisse gefunden</p>
            <button
              onClick={() => { setSearch(""); setFilterDriver("all"); setFilterDate(""); }}
              style={{ ...S.btn, ...S.btnGray, marginTop: 12 }}>
              Filter zurücksetzen
            </button>
          </div>
        )}

      </div>
    </main>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#020617 0%,#04122b 50%,#020617 100%)",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: 1200, margin: "0 auto" },
  logo: { width: 180, borderRadius: 24, marginBottom: 24 },

  // Toasts
  toastContainer: {
    position: "fixed", top: 24, right: 24, zIndex: 9999,
    display: "flex", flexDirection: "column", gap: 10,
  },
  toast: {
    padding: "14px 20px", borderRadius: 12, fontWeight: "bold",
    fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", minWidth: 260,
    animation: "fadeIn 0.3s ease",
  },
  toastSuccess: { background: "#14532d", color: "#86efac", border: "1px solid #22c55e" },
  toastError: { background: "#7f1d1d", color: "#fca5a5", border: "1px solid #ef4444" },

  // Stats
  statsRow: { display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" },
  statCard: {
    flex: 1, minWidth: 110,
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 20, padding: "18px 16px", textAlign: "center",
  },
  statValue: { fontSize: 38, fontWeight: "bold", margin: 0, lineHeight: 1 },
  statLabel: {
    color: "#475569", fontSize: 12, margin: "6px 0 0",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },

  // Progress
  progressWrapper: { marginBottom: 24 },
  progressBar: {
    height: 8, background: "rgba(255,255,255,0.06)",
    borderRadius: 999, overflow: "hidden", marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #2563eb, #22c55e)",
    borderRadius: 999, transition: "width 0.6s ease",
  },
  progressText: { color: "#475569", fontSize: 12, margin: 0, textAlign: "right" },

  // Card
  card: {
    background: "rgba(15,23,42,0.9)", padding: 30, borderRadius: 28,
    marginBottom: 24, border: "1px solid rgba(255,255,255,0.07)",
  },
  heading: { color: "white", fontSize: 34, margin: "0 0 20px", fontWeight: "bold" },
  label: {
    display: "block", color: "#475569", fontSize: 11,
    marginBottom: 8, marginTop: 16,
    textTransform: "uppercase", letterSpacing: "0.07em",
  },
  select: {
    width: 300, padding: "12px 16px", borderRadius: 12,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", fontSize: 14,
  },
  fileInput: { display: "block", marginTop: 8, marginBottom: 4, color: "#94a3b8" },
  buttonRow: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 },

  // Buttons
  btn: {
    border: "none", padding: "12px 20px", borderRadius: 12,
    fontWeight: "bold", cursor: "pointer", fontSize: 13,
    transition: "opacity 0.2s, transform 0.1s",
  },
  btnBlue: { background: "#2563eb", color: "white" },
  btnGreen: { background: "#16a34a", color: "white" },
  btnRed: { background: "#dc2626", color: "white" },
  btnGray: { background: "rgba(255,255,255,0.09)", color: "white" },

  // Filter
  filterRow: {
    display: "flex", gap: 12, marginBottom: 28,
    flexWrap: "wrap", alignItems: "center",
  },
  searchInput: {
    flex: 2, minWidth: 200, padding: "12px 16px", borderRadius: 12,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", fontSize: 14,
  },
  filterSelect: {
    flex: 1, minWidth: 150, padding: "12px 16px", borderRadius: 12,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", fontSize: 14,
  },
  dateInput: {
    flex: 1, minWidth: 150, padding: "12px 16px", borderRadius: 12,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", fontSize: 14,
  },

  // Sections
  section: { marginBottom: 32 },
  sectionTitle: {
    marginBottom: 16, fontSize: 20, fontWeight: "bold",
    display: "flex", alignItems: "center", gap: 10,
  },
  badge: {
    background: "rgba(255,255,255,0.08)", color: "white",
    fontSize: 13, borderRadius: 999, padding: "2px 12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
  stopCard: {
    background: "rgba(255,255,255,0.04)", padding: 20,
    borderRadius: 16, border: "1px solid",
  },
  stopName: { color: "white", margin: "0 0 10px", fontSize: 16, fontWeight: "bold" },
  stopDetail: { color: "#94a3b8", margin: "4px 0", fontSize: 14 },

  // Empty
  emptyState: { textAlign: "center", padding: "60px 0" },
};
