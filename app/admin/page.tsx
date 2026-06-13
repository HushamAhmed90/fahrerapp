"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  query, where, getDocs, onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";

const ADMIN_PASSWORD = "admin123";

type Driver = { id: string; name: string; active: boolean };
type Stop = {
  id: string; name: string; adresse: string;
  telefon?: string; notiz?: string; fahrer: string;
  status: string; deliveredDate?: string; deliveredTime?: string;
  nachbar?: string; photoURL?: string; gpsLat?: number; gpsLng?: number;
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

const inp: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "0.5px solid #d4a8a8", background: "#fdf6f0", color: "#2c1a1a", fontSize: 14 };
const card: React.CSSProperties = { background: "#fff8f5", padding: 28, borderRadius: 20, marginBottom: 24, border: "0.5px solid #e0b8b0" };
const btn = (bg: string, color: string, disabled = false): React.CSSProperties => ({ background: bg, color, border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: "bold", cursor: disabled ? "default" : "pointer", fontSize: 13, opacity: disabled ? 0.55 : 1 });

export default function AdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [pw, setPw] = useState("");
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
  const [photoModal, setPhotoModal] = useState<Stop | null>(null);
  const [editStop, setEditStop] = useState<Stop | null>(null);
  const [editNotiz, setEditNotiz] = useState("");

  function showToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  function loginAdmin() {
    if (pw === ADMIN_PASSWORD) {
      localStorage.setItem("adminAllowed", "yes");
      setAllowed(true);
    } else {
      showToast("Falsches Passwort!", "error");
    }
  }

  function logoutAdmin() {
    localStorage.removeItem("adminAllowed");
    setAllowed(false);
    setPw("");
  }

  useEffect(() => {
    if (localStorage.getItem("adminAllowed") === "yes") setAllowed(true);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    async function loadDrivers() {
      try {
        const snapshot = await getDocs(collection(db, "drivers"));
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Driver, "id">) })).filter((d) => d.active);
        setDrivers(list);
        if (list.length > 0) setSelectedDriver(list[0].name);
      } catch { showToast("Fahrer konnten nicht geladen werden.", "error"); }
    }
    loadDrivers();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    const unsubscribe = onSnapshot(collection(db, "touren"),
      (snapshot) => { setTour(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Stop, "id">) }))); },
      () => showToast("Verbindungsfehler", "error")
    );
    return () => unsubscribe();
  }, [allowed]);

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
    withPhoto: tour.filter((s) => s.photoURL).length,
  }), [tour]);

  const completionPercent = stats.total > 0 ? Math.round(((stats.total - stats.pending) / stats.total) * 100) : 0;

  // per-driver stats for daily report
  const driverStats = useMemo(() => {
    const map: Record<string, { delivered: number; wrong: number; pending: number; total: number }> = {};
    tour.forEach((s) => {
      if (!map[s.fahrer]) map[s.fahrer] = { delivered: 0, wrong: 0, pending: 0, total: 0 };
      map[s.fahrer].total++;
      if (s.status === "Geliefert" || s.status === "Beim Nachbarn" || s.status === "Vor die Tür") map[s.fahrer].delivered++;
      else if (s.status === "Falsche Adresse") map[s.fahrer].wrong++;
      else map[s.fahrer].pending++;
    });
    return map;
  }, [tour]);

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
      for (let i = 0; i < result.data.length; i++) {
        const item = result.data[i] as Partial<Stop> & { order?: number };
        await addDoc(collection(db, "touren"), {
          name: item.name ?? "",
          adresse: item.adresse ?? "",
          telefon: item.telefon ?? "",
          notiz: item.notiz ?? "",
          fahrer: selectedDriver,
          status: "",
          deliveredDate: "",
          deliveredTime: "",
          order: i,
        });
      }
      showToast("Tour erfolgreich importiert ✅");
      setFile(null);
    } catch { showToast("Fehler beim PDF-Upload", "error"); }
    finally { setLoading(false); }
  }

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ name: string; adresse: string; notiz: string }[] | null>(null);

  async function readPhoto() {
    if (!photoFile) { showToast("Bitte Foto wählen", "error"); return; }
    setPhotoLoading(true);
    setPhotoPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", photoFile);
      const res = await fetch("/api/read-photo", { method: "POST", body: formData });
      const result = await res.json();
      if (!result.success) { showToast(result.error ?? "Fehler beim Lesen", "error"); return; }
      setPhotoPreview(result.data);
      showToast(`${result.data.length} Stops erkannt ✅`);
    } catch { showToast("Fehler beim Foto-Upload", "error"); }
    finally { setPhotoLoading(false); }
  }

  async function importPhotoStops() {
    if (!photoPreview || !selectedDriver) { showToast("Bitte Fahrer auswählen", "error"); return; }
    for (let i = 0; i < photoPreview.length; i++) {
      const item = photoPreview[i];
      await addDoc(collection(db, "touren"), {
        name: item.name ?? "",
        adresse: item.adresse ?? "",
        telefon: "",
        notiz: item.notiz ?? "",
        fahrer: selectedDriver,
        status: "",
        deliveredDate: "",
        deliveredTime: "",
        order: (tour.filter(s => s.fahrer === selectedDriver).length) + i,
      });
    }
    showToast(`${photoPreview.length} Stops importiert ✅`);
    setPhotoPreview(null);
    setPhotoFile(null);
  }

  const [fleuropLoading, setFleuropLoading] = useState(false);

  async function importFleurop() {
    if (!selectedDriver) { showToast("Bitte Fahrer auswählen", "error"); return; }
    setFleuropLoading(true);
    try {
      const res = await fetch("/api/fleurop-import", { method: "POST" });
      const result = await res.json();
      if (result.debug) console.log("Fleurop debug:", result.debug);
      if (!result.success || !result.stops?.length) {
        showToast(result.message ?? `Debug: ${JSON.stringify(result.debug)}`, "error");
        return;
      }
      for (let i = 0; i < result.stops.length; i++) {
        const s = result.stops[i];
        await addDoc(collection(db, "touren"), {
          name: s.name ?? "",
          adresse: s.adresse ?? "",
          telefon: s.telefon ?? "",
          notiz: s.notiz ?? "",
          fahrer: selectedDriver,
          status: "",
          deliveredDate: "",
          deliveredTime: "",
          order: s.order ?? i,
        });
      }
      showToast(`${result.stops.length} Aufträge von Fleurop importiert ✅`);
    } catch { showToast("Fehler beim Fleurop Import", "error"); }
    finally { setFleuropLoading(false); }
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
      await Promise.all(snapshot.docs.map((d) => updateDoc(doc(db, "touren", d.id), { status: "", deliveredDate: "", deliveredTime: "", photoURL: "", gpsLat: null, gpsLng: null })));
      showToast("Status erfolgreich zurückgesetzt ✅");
    } catch { showToast("Fehler beim Zurücksetzen", "error"); }
    finally { setResetting(false); }
  }

  async function saveEditNotiz() {
    if (!editStop) return;
    await updateDoc(doc(db, "touren", editStop.id), { notiz: editNotiz });
    showToast("Notiz gespeichert ✅");
    setEditStop(null);
  }

  function exportCSV() {
    const headers = ["Name", "Adresse", "Telefon", "Fahrer", "Status", "Datum", "Zeit", "Nachbar"];
    const rows = filteredTour.map((s) => [s.name, s.adresse, s.telefon ?? "", s.fahrer, s.status, s.deliveredDate ?? "", s.deliveredTime ?? "", s.nachbar ?? ""]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tour-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("Export erfolgreich ✅");
  }

  function printList() {
    const items = filteredTour.filter((s) => !s.status);
    const html = `<html><head><title>Tour</title><style>body{font-family:Georgia,serif;padding:20px;color:#2c1a1a} h1{color:#c08878} table{width:100%;border-collapse:collapse} td,th{border:1px solid #e0b8b0;padding:8px;text-align:left;font-size:13px} th{background:#fdf6f0;color:#b07878}</style></head><body>
      <h1>Dirk Schröder — Offene Stopps (${new Date().toLocaleDateString("de-DE")})</h1>
      <table><tr><th>#</th><th>Name</th><th>Adresse</th><th>Telefon</th><th>Fahrer</th><th>Notiz</th></tr>
      ${items.map((s, i) => `<tr><td>${i + 1}</td><td>${s.name}</td><td>${s.adresse}</td><td>${s.telefon ?? ""}</td><td>${s.fahrer}</td><td>${s.notiz ?? ""}</td></tr>`).join("")}
      </table></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  const sections: { title: string; status: StatusFilter; color: string }[] = [
    { title: "⏳ Offen", status: "", color: "#b07830" },
    { title: "✅ Geliefert", status: "Geliefert", color: "#3a7a50" },
    { title: "🏠 Beim Nachbarn", status: "Beim Nachbarn", color: "#9a6030" },
    { title: "🚪 Vor die Tür", status: "Vor die Tür", color: "#4a6a9a" },
    { title: "❌ Falsche Adresse", status: "Falsche Adresse", color: "#9a4a4a" },
  ];

  // ── Login Screen ──────────────────────────────────────────────────────────
  if (!allowed) {
    return (
      <main style={{ minHeight: "100vh", background: "#fdf6f0", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
        <div dangerouslySetInnerHTML={{ __html: tulpenSVG }} />
        {toasts.length > 0 && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999 }}>
            {toasts.map((t) => (
              <div key={t.id} style={{ padding: "14px 20px", borderRadius: 12, fontWeight: "bold", fontSize: 14, background: t.type === "error" ? "#f5dddd" : "#ddf0e0", color: t.type === "error" ? "#9a4a4a" : "#3a7a50", border: `0.5px solid ${t.type === "error" ? "#e0b8b0" : "#a8c8a0"}` }}>{t.message}</div>
            ))}
          </div>
        )}
        <div style={{ ...card, maxWidth: 400, width: "100%", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <img src="/logo.png" alt="Dirk Schröder" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: "50%" }} />
            <p style={{ color: "#2c1a1a", fontSize: 20, fontWeight: 500, margin: "8px 0 0", fontFamily: "Georgia, serif" }}>Dirk Schröder</p>
            <p style={{ color: "#b07878", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", margin: "4px 0 0" }}>· Admin Dashboard ·</p>
          </div>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginAdmin()} placeholder="Admin Passwort" style={{ ...inp, width: "100%", marginBottom: 12, boxSizing: "border-box" }} />
          <button onClick={loginAdmin} style={{ ...btn("#c08878", "white"), width: "100%", padding: "12px" }}>Login</button>
        </div>
      </main>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "#fdf6f0", padding: 24, fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div dangerouslySetInnerHTML={{ __html: tulpenSVG }} />

      {/* Toasts */}
      <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: "14px 20px", borderRadius: 12, fontWeight: "bold", fontSize: 14, minWidth: 260, background: t.type === "error" ? "#f5dddd" : "#ddf0e0", color: t.type === "error" ? "#9a4a4a" : "#3a7a50", border: `0.5px solid ${t.type === "error" ? "#e0b8b0" : "#a8c8a0"}` }}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Photo Modal */}
      {photoModal && (
        <div onClick={() => setPhotoModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff8f5", borderRadius: 20, padding: 24, maxWidth: 520, width: "100%", border: "0.5px solid #e0b8b0" }}>
            <p style={{ color: "#2c1a1a", fontFamily: "Georgia, serif", fontSize: 16, margin: "0 0 12px", fontWeight: 500 }}>{photoModal.name}</p>
            <p style={{ color: "#8a7070", fontSize: 13, margin: "0 0 14px" }}>📍 {photoModal.adresse}</p>
            {photoModal.photoURL && <img src={photoModal.photoURL} alt="Lieferfoto" style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />}
            {photoModal.gpsLat && (
              <a href={`https://www.google.com/maps?q=${photoModal.gpsLat},${photoModal.gpsLng}`} target="_blank" style={{ display: "inline-block", color: "#4a6a9a", fontSize: 13, fontWeight: "bold", textDecoration: "none", marginBottom: 12 }}>
                📍 GPS auf Google Maps öffnen
              </a>
            )}
            <p style={{ color: "#3a7a50", fontSize: 13, margin: "0 0 16px" }}>📅 {photoModal.deliveredDate} {photoModal.deliveredTime}</p>
            <button onClick={() => setPhotoModal(null)} style={{ ...btn("#f5e8e0", "#b07878"), width: "100%" }}>Schließen</button>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editStop && (
        <div onClick={() => setEditStop(null)} style={{ position: "fixed", inset: 0, zIndex: 9997, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff8f5", borderRadius: 20, padding: 24, maxWidth: 420, width: "100%", border: "0.5px solid #e0b8b0" }}>
            <p style={{ color: "#2c1a1a", fontFamily: "Georgia, serif", fontSize: 16, margin: "0 0 16px", fontWeight: 500 }}>Notiz bearbeiten — {editStop.name}</p>
            <textarea value={editNotiz} onChange={(e) => setEditNotiz(e.target.value)} rows={4} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveEditNotiz} style={btn("#ddf0e0", "#3a7a50")}>💾 Speichern</button>
              <button onClick={() => setEditStop(null)} style={btn("#f5e8e0", "#b07878")}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28, paddingBottom: 20, borderBottom: "0.5px solid #e8c8c0" }}>
          <img src="/logo.png" alt="Dirk Schröder" style={{ width: 90, height: 90, objectFit: "contain", borderRadius: "50%" }} />
          <p style={{ color: "#2c1a1a", fontSize: 22, fontWeight: 500, margin: "6px 0 0", fontFamily: "Georgia, serif" }}>Dirk Schröder</p>
          <p style={{ color: "#b07878", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", margin: "4px 0 0" }}>· Admin Dashboard ·</p>
          <button onClick={logoutAdmin} style={{ ...btn("#f5dddd", "#9a4a4a"), marginTop: 12 }}>🚪 Logout</button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Gesamt", value: stats.total, color: "#8a7070" },
            { label: "Offen", value: stats.pending, color: "#b07830" },
            { label: "Geliefert", value: stats.delivered, color: "#3a7a50" },
            { label: "Nachbar", value: stats.neighbor, color: "#9a6030" },
            { label: "Falsch", value: stats.wrong, color: "#9a4a4a" },
            { label: "📸 Fotos", value: stats.withPhoto, color: "#6a5aaa" },
          ].map((stat) => (
            <div key={stat.label} style={{ flex: 1, minWidth: 100, background: "#fff8f5", border: "0.5px solid #e0b8b0", borderRadius: 16, padding: "18px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 34, fontWeight: 500, margin: 0, color: stat.color, fontFamily: "Georgia, serif" }}>{stat.value}</p>
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

        {/* Daily Report per Driver */}
        {Object.keys(driverStats).length > 0 && (
          <div style={card}>
            <h2 style={{ color: "#2c1a1a", fontSize: 18, margin: "0 0 16px", fontFamily: "Georgia, serif", fontWeight: 500 }}>📊 Tagesbericht</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {Object.entries(driverStats).map(([name, s]) => (
                <div key={name} style={{ background: "#fdf6f0", border: "0.5px solid #e0b8b0", borderRadius: 14, padding: "14px 18px", minWidth: 160 }}>
                  <p style={{ color: "#2c1a1a", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 500, margin: "0 0 10px" }}>{name}</p>
                  <p style={{ color: "#3a7a50", fontSize: 13, margin: "3px 0" }}>✅ Geliefert: {s.delivered}</p>
                  <p style={{ color: "#b07830", fontSize: 13, margin: "3px 0" }}>⏳ Offen: {s.pending}</p>
                  <p style={{ color: "#9a4a4a", fontSize: 13, margin: "3px 0" }}>❌ Falsch: {s.wrong}</p>
                  <div style={{ marginTop: 8, height: 4, background: "#f0ddd8", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#c08878", width: `${s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Card */}
        <div style={card}>
          <h2 style={{ color: "#2c1a1a", fontSize: 20, margin: "0 0 20px", fontFamily: "Georgia, serif", fontWeight: 500 }}>Tour Upload</h2>
          <label style={{ display: "block", color: "#b07878", fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Fahrer auswählen</label>
          <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} style={{ ...inp, width: 300, marginBottom: 16 }}>
            <option value="">– Fahrer wählen –</option>
            {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          {/* Photo import */}
          <div style={{ background: "#fdf6f0", border: "1px dashed #e0b8b0", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
            <p style={{ color: "#7c2d12", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>📸 Foto / WhatsApp-Bild importieren</p>
            <input type="file" accept="image/*" onChange={(e) => { setPhotoFile(e.target.files?.[0] ?? null); setPhotoPreview(null); }}
              style={{ display: "block", marginBottom: 10, color: "#8a7070", fontSize: 13 }} />
            <button onClick={readPhoto} disabled={photoLoading || !photoFile} style={btn("#fde8d0", "#9a5a20", photoLoading || !photoFile)}>
              {photoLoading ? "⏳ KI liest…" : "🤖 KI liest Handschrift"}
            </button>
            {photoPreview && (
              <div style={{ marginTop: 14 }}>
                <p style={{ color: "#3a7a50", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>✅ {photoPreview.length} Stops erkannt — bitte prüfen:</p>
                <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 10 }}>
                  {photoPreview.map((s, i) => (
                    <div key={i} style={{ background: "white", border: "1px solid #f0ddd8", borderRadius: 10, padding: "10px 12px", marginBottom: 8, fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ color: "#b07878", fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
                        <input value={s.name} onChange={e => setPhotoPreview(prev => prev!.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          placeholder="Name" style={{ flex: 1, padding: "4px 8px", borderRadius: 8, border: "1px solid #f0ddd8", fontSize: 13, color: "#2c1a1a" }} />
                        <button onClick={() => setPhotoPreview(prev => prev!.filter((_, j) => j !== i))}
                          style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#991b1b", fontSize: 12 }}>✕</button>
                      </div>
                      <input value={s.adresse} onChange={e => setPhotoPreview(prev => prev!.map((x, j) => j === i ? { ...x, adresse: e.target.value } : x))}
                        placeholder="📍 Adresse" style={{ width: "100%", padding: "4px 8px", borderRadius: 8, border: "1px solid #f0ddd8", fontSize: 12, color: "#6b5050", marginBottom: 4, boxSizing: "border-box" }} />
                      <input value={s.notiz} onChange={e => setPhotoPreview(prev => prev!.map((x, j) => j === i ? { ...x, notiz: e.target.value } : x))}
                        placeholder="📝 Notiz / Bemerkung" style={{ width: "100%", padding: "4px 8px", borderRadius: 8, border: "1px solid #f0ddd8", fontSize: 12, color: "#9a6030", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
                <button onClick={importPhotoStops} disabled={!selectedDriver} style={btn("#ddf0e0", "#3a7a50", !selectedDriver)}>
                  ✅ Alle importieren → {selectedDriver || "Fahrer wählen"}
                </button>
              </div>
            )}
          </div>

          <label style={{ display: "block", color: "#b07878", fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>PDF-Datei</label>
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "block", marginBottom: 4, color: "#8a7070" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button onClick={uploadPDF} disabled={loading || !file || !selectedDriver} style={btn("#dde8f5", "#4a6a9a", loading || !file || !selectedDriver)}>
              {loading ? "⏳ Lädt…" : "📄 PDF lesen"}
            </button>
            <button onClick={importFleurop} disabled={fleuropLoading || !selectedDriver} style={btn("#fff3cd", "#856404", fleuropLoading || !selectedDriver)}>
              {fleuropLoading ? "⏳ Importiere…" : "🌸 Fleurop importieren"}
            </button>
            <button onClick={resetStatuses} disabled={resetting} style={btn("#ddf0e0", "#3a7a50", resetting)}>
              {resetting ? "⏳ Lädt…" : "🔄 Status zurücksetzen"}
            </button>
            <button onClick={deletePlan} disabled={deletingPlan || !selectedDriver} style={btn("#f5dddd", "#9a4a4a", deletingPlan || !selectedDriver)}>
              {deletingPlan ? "⏳ Löscht…" : "🗑️ Plan löschen"}
            </button>
            <button onClick={exportCSV} style={btn("#f0eaf5", "#8a5a9a")}>📤 CSV Export</button>
            <button onClick={printList} style={btn("#fdeedd", "#9a6030")}>🖨️ Drucken</button>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="🔍 Name oder Adresse suchen…" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ ...inp, flex: 2, minWidth: 200 }} />
          <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} style={{ ...inp, flex: 1, minWidth: 150 }}>
            <option value="all">Alle Fahrer</option>
            {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...inp, flex: 1, minWidth: 150 }} />
          {(search || filterDriver !== "all" || filterDate) && (
            <button onClick={() => { setSearch(""); setFilterDriver("all"); setFilterDate(""); }}
              style={btn("#f5e8e0", "#b07878")}>✕ Reset</button>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
                {items.map((stop) => (
                  <div key={stop.id} style={{ background: "#fff8f5", padding: 18, borderRadius: 14, border: `0.5px solid ${color}` }}>
                    <p style={{ color: "#2c1a1a", margin: "0 0 8px", fontSize: 15, fontWeight: 500, fontFamily: "Georgia, serif" }}>{stop.name}</p>
                    <p style={{ color: "#8a7070", margin: "3px 0", fontSize: 13 }}>📍 {stop.adresse}</p>
                    {stop.telefon && <p style={{ color: "#8a7070", margin: "3px 0", fontSize: 13 }}>📞 {stop.telefon}</p>}
                    {stop.notiz && <p style={{ color: "#8a7070", margin: "3px 0", fontSize: 13 }}>📝 {stop.notiz}</p>}
                    {stop.nachbar && <p style={{ color: "#9a6030", margin: "3px 0", fontSize: 13 }}>🏠 Nachbar: {stop.nachbar}</p>}
                    <p style={{ color, margin: "8px 0 4px", fontSize: 13, fontWeight: 500 }}>🚚 {stop.fahrer}</p>
                    {stop.deliveredDate && <p style={{ color: "#3a7a50", margin: "3px 0", fontSize: 13 }}>📅 {stop.deliveredDate} {stop.deliveredTime}</p>}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      {stop.photoURL && (
                        <button onClick={() => setPhotoModal(stop)} style={btn("#e8e0f5", "#6a5aaa")}>📸 Foto</button>
                      )}
                      <button onClick={() => { setEditStop(stop); setEditNotiz(stop.notiz ?? ""); }} style={btn("#dde8f5", "#4a6a9a")}>✏️ Notiz</button>
                      <button onClick={() => { if (confirm("Stopp löschen?")) deleteDoc(doc(db, "touren", stop.id)).then(() => showToast("Gelöscht ✅")); }} style={btn("#f5dddd", "#9a4a4a")}>🗑️</button>
                    </div>
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
              style={{ ...btn("#f5e8e0", "#b07878"), marginTop: 12 }}>Filter zurücksetzen</button>
          </div>
        )}

        {tour.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ fontSize: 48, margin: 0 }}>🌷</p>
            <p style={{ color: "#b07878", fontSize: 16, fontFamily: "Georgia, serif", marginTop: 12 }}>Noch keine Stopps. PDF hochladen!</p>
          </div>
        )}
      </div>
    </main>
  );
}
