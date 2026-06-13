"use client";
import { useEffect, useState } from "react";

export function BremenCrest() {
  return (
    <svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}>
      <path d="M12 12 H188 V170 Q100 252 100 252 Q100 252 12 170 Z" fill="#C8102E" stroke="#8B0000" strokeWidth="3"/>
      <rect x="88" y="70" width="24" height="130" rx="4" fill="white"/>
      <circle cx="100" cy="68" r="38" fill="none" stroke="white" strokeWidth="20"/>
      <circle cx="100" cy="68" r="18" fill="#C8102E"/>
      <rect x="112" y="148" width="22" height="16" rx="3" fill="white"/>
      <rect x="112" y="174" width="16" height="16" rx="3" fill="white"/>
    </svg>
  );
}

export function DigitalClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      setTime(now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDate(now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" }));
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "rgba(255,255,255,0.85)", border: "1px solid #f3d5d5", borderRadius: 20, padding: "20px 16px", textAlign: "center", boxShadow: "0 2px 12px rgba(180,80,80,0.08)" }}>
      <p style={{ color: "#b91c1c", fontSize: 11, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>Bremen</p>
      <p style={{ color: "#1c1c1c", fontFamily: "monospace", fontSize: 32, fontWeight: "bold", letterSpacing: "0.05em", margin: "0 0 4px" }}>{time || "00:00:00"}</p>
      <p style={{ color: "#9ca3af", fontSize: 12 }}>{date || "—"}</p>
    </div>
  );
}

export function BremenCrestCard() {
  return (
    <div style={{ background: "rgba(255,255,255,0.85)", border: "1px solid #f3d5d5", borderRadius: 20, padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, boxShadow: "0 2px 12px rgba(180,80,80,0.08)" }}>
      <div style={{ width: 64, height: 88 }}>
        <BremenCrest />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontWeight: "bold", color: "#1c1c1c", fontSize: 13, marginBottom: 2 }}>Freie Hansestadt</p>
        <p style={{ color: "#b91c1c", fontWeight: 600, fontSize: 13 }}>Bremen</p>
      </div>
    </div>
  );
}
