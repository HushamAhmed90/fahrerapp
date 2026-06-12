"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Driver = {
  id: string;
  name: string;
  active: boolean;
};

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [tour, setTour] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Load drivers from Firestore ──────────────────────────────────────────

  useEffect(() => {
    async function loadDrivers() {
      try {
        const snapshot = await getDocs(collection(db, "drivers"));
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Driver, "id">) }))
          .filter((d) => d.active);
        setDrivers(list);
        if (list.length > 0) setSelectedDriver(list[0].name);
      } catch (err) {
        console.error("Fehler beim Laden der Fahrer:", err);
        setError("Fahrer konnten nicht geladen werden.");
      }
    }
    loadDrivers();
  }, []);

  // ─── Load tour stops ──────────────────────────────────────────────────────

  const loadTour = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "touren"));
      const allStops: Stop[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Stop, "id">),
      }));
      setTour(allStops);
    } catch (err) {
      console.error("Fehler beim Laden der Tour:", err);
      setError("Tour konnte nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    loadTour();
  }, [loadTour]);

  // ─── Upload PDF ───────────────────────────────────────────────────────────

  async function uploadPDF() {
    if (!file) {
      alert("Bitte PDF wählen");
      return;
    }
    if (!selectedDriver) {
      alert("Bitte Fahrer auswählen");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/read-tour", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error ?? "Unbekannter Fehler");
        return;
      }

      // Upload all stops in parallel
      await Promise.all(
        result.data.map((item: Partial<Stop>) =>
          addDoc(collection(db, "touren"), {
            name: item.name ?? "",
            adresse: item.adresse ?? "",
            telefon: item.telefon ?? "",
            notiz: item.notiz ?? "",
            fahrer: selectedDriver,
            status: "",
            deliveredDate: "",
            deliveredTime: "",
          })
        )
      );

      await loadTour();
      alert("Tour erfolgreich importiert");
    } catch (err) {
      console.error(err);
      setError("Fehler beim PDF-Upload. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Delete plan ──────────────────────────────────────────────────────────

  async function deletePlan() {
    if (!selectedDriver) return;
    const confirmed = confirm(`Plan von ${selectedDriver} löschen?`);
    if (!confirmed) return;

    setDeletingPlan(true);
    setError(null);

    try {
      const q = query(
        collection(db, "touren"),
        where("fahrer", "==", selectedDriver)
      );
      const snapshot = await getDocs(q);

      // Delete all matching stops in parallel
      await Promise.all(
        snapshot.docs.map((d) => deleteDoc(doc(db, "touren", d.id)))
      );

      await loadTour();
      alert("Plan gelöscht");
    } catch (err) {
      console.error(err);
      setError("Plan konnte nicht gelöscht werden.");
    } finally {
      setDeletingPlan(false);
    }
  }

  // ─── Reset statuses ───────────────────────────────────────────────────────

  async function resetStatuses() {
    const confirmed = confirm("Status aller Stopps zurücksetzen?");
    if (!confirmed) return;

    setResetting(true);
    setError(null);

    try {
      const snapshot = await getDocs(collection(db, "touren"));

      await Promise.all(
        snapshot.docs.map((d) =>
          updateDoc(doc(db, "touren", d.id), {
            status: "",
            deliveredDate: "",
            deliveredTime: "",
          })
        )
      );

      await loadTour();
      alert("Status erfolgreich zurückgesetzt");
    } catch (err) {
      console.error(err);
      setError("Status konnte nicht zurückgesetzt werden.");
    } finally {
      setResetting(false);
    }
  }

  // ─── Filter stops by status ───────────────────────────────────────────────

  function filterByStatus(status: StatusFilter): Stop[] {
    return tour.filter((stop) => stop.status === status);
  }

  const sections: { title: string; status: StatusFilter; color: string }[] = [
    { title: "⏳ Offen", status: "", color: "#facc15" },
    { title: "✅ Geliefert", status: "Geliefert", color: "#22c55e" },
    { title: "🏠 Beim Nachbarn", status: "Beim Nachbarn", color: "#f97316" },
    { title: "🚪 Vor die Tür", status: "Vor die Tür", color: "#3b82f6" },
    { title: "❌ Falsche Adresse", status: "Falsche Adresse", color: "#ef4444" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <img src="/logo.png" alt="logo" style={styles.logo} />

        {/* ── Error Banner ── */}
        {error && (
          <div style={styles.errorBanner}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
          </div>
        )}

        {/* ── Upload Panel ── */}
        <div style={styles.card}>
          <h1 style={styles.heading}>Tour Upload</h1>

          <label style={styles.label}>Fahrer auswählen</label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            style={styles.select}
          >
            <option value="">– Fahrer wählen –</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.name}>
                {driver.name}
              </option>
            ))}
          </select>

          <label style={styles.label}>PDF-Datei</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={styles.fileInput}
          />

          <div style={styles.buttonRow}>
            <button
              onClick={uploadPDF}
              disabled={loading || !file || !selectedDriver}
              style={{ ...styles.button, ...styles.btnBlue, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Lädt…" : "PDF automatisch lesen"}
            </button>

            <button
              onClick={resetStatuses}
              disabled={resetting}
              style={{ ...styles.button, ...styles.btnGreen, opacity: resetting ? 0.7 : 1 }}
            >
              {resetting ? "Lädt…" : "Status zurücksetzen"}
            </button>

            <button
              onClick={deletePlan}
              disabled={deletingPlan || !selectedDriver}
              style={{ ...styles.button, ...styles.btnRed, opacity: deletingPlan ? 0.7 : 1 }}
            >
              {deletingPlan ? "Löscht…" : "Plan löschen"}
            </button>
          </div>
        </div>

        {/* ── Tour Sections ── */}
        {sections.map(({ title, status, color }) => {
          const items = filterByStatus(status);
          if (items.length === 0) return null;
          return (
            <section key={status} style={styles.section}>
              <h2 style={{ ...styles.sectionTitle, color }}>
                {title} <span style={styles.badge}>{items.length}</span>
              </h2>

              {items.map((stop) => (
                <div key={stop.id} style={{ ...styles.stopCard, borderColor: color }}>
                  <h3 style={styles.stopName}>{stop.name}</h3>
                  <p style={styles.stopDetail}>📍 {stop.adresse}</p>
                  {stop.telefon && <p style={styles.stopDetail}>📞 {stop.telefon}</p>}
                  {stop.notiz && <p style={styles.stopDetail}>📝 {stop.notiz}</p>}
                  <p style={{ ...styles.stopDetail, color, fontWeight: "bold", marginTop: 8 }}>
                    🚚 {stop.fahrer}
                  </p>
                  {stop.deliveredDate && (
                    <p style={{ ...styles.stopDetail, color: "#86efac" }}>
                      📅 {stop.deliveredDate}
                    </p>
                  )}
                  {stop.deliveredTime && (
                    <p style={{ ...styles.stopDetail, color: "#86efac" }}>
                      ⏰ {stop.deliveredTime}
                    </p>
                  )}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </main>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#020617 0%,#04122b 50%,#020617 100%)",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  logo: {
    width: 180,
    borderRadius: 24,
    marginBottom: 20,
  },
  errorBanner: {
    background: "rgba(220,38,38,0.2)",
    border: "1px solid #ef4444",
    color: "#fca5a5",
    borderRadius: 12,
    padding: "14px 20px",
    marginBottom: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorClose: {
    background: "none",
    border: "none",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 16,
  },
  card: {
    background: "rgba(15,23,42,0.88)",
    padding: 30,
    borderRadius: 30,
    marginBottom: 30,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  heading: {
    color: "white",
    marginBottom: 25,
    fontSize: 40,
    margin: "0 0 25px",
  },
  label: {
    display: "block",
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 8,
    marginTop: 16,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  select: {
    width: 320,
    padding: 15,
    borderRadius: 14,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "white",
    fontSize: 15,
  },
  fileInput: {
    display: "block",
    marginBottom: 20,
    color: "white",
  },
  buttonRow: {
    display: "flex",
    gap: 15,
    flexWrap: "wrap",
    marginTop: 20,
  },
  button: {
    border: "none",
    padding: "14px 24px",
    borderRadius: 14,
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 14,
    transition: "opacity 0.2s",
  },
  btnBlue: { background: "#2563eb", color: "white" },
  btnGreen: { background: "#22c55e", color: "white" },
  btnRed: { background: "#dc2626", color: "white" },
  section: { marginBottom: 30 },
  sectionTitle: {
    marginBottom: 20,
    fontSize: 22,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    background: "rgba(255,255,255,0.1)",
    color: "white",
    fontSize: 14,
    borderRadius: 999,
    padding: "2px 10px",
  },
  stopCard: {
    background: "rgba(255,255,255,0.08)",
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    border: "1px solid",
  },
  stopName: {
    color: "white",
    marginBottom: 10,
    margin: "0 0 10px",
  },
  stopDetail: {
    color: "#d1d5db",
    margin: "4px 0",
  },
};
