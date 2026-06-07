"use client";

import { useEffect, useState } from "react";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../firebase";

type Stop = {
  id?: string;
  name?: string;
  adresse?: string;
  telefon?: string;
  notiz?: string;
  fahrer?: string;
  status?: string;
  deliveredDate?: string;
  deliveredTime?: string;
};

export default function AdminPage() {
  const [selectedDriver, setSelectedDriver] =
    useState("mohammed");

  const [file, setFile] =
    useState<File | null>(null);

  const [tour, setTour] = useState<
    Stop[]
  >([]);

  const [loading, setLoading] =
    useState(false);

  const drivers = [
    "mohammed",
    "Hisham",
    "Mahmoud",
    "Rainer",
    "Hans",
  ];

  useEffect(() => {
    loadTour();
  }, []);

  async function loadTour() {
    const snapshot =
      await getDocs(
        collection(db, "touren")
      );

    const allStops: Stop[] = [];

    snapshot.forEach((document) => {
      allStops.push({
        id: document.id,
        ...(document.data() as Omit<
          Stop,
          "id"
        >),
      });
    });

    setTour(allStops);
  }

  async function uploadPDF() {
    if (!file) {
      alert("Bitte PDF wählen");
      return;
    }

    setLoading(true);

    try {
      const formData =
        new FormData();

      formData.append("file", file);

      const response =
        await fetch(
          "/api/read-tour",
          {
            method: "POST",
            body: formData,
          }
        );

      const result =
        await response.json();

      if (!result.success) {
        alert(result.error);
        setLoading(false);
        return;
      }

      for (const item of result.data) {
        await addDoc(
          collection(db, "touren"),
          {
            name:
              item.name || "",

            adresse:
              item.adresse || "",

            telefon:
              item.telefon || "",

            notiz:
              item.notiz || "",

            fahrer:
              selectedDriver,

            status: "",

            deliveredDate:
              "",

            deliveredTime:
              "",
          }
        );
      }

      await loadTour();

      alert(
        "Tour erfolgreich importiert"
      );
    } catch (error) {
      console.error(error);

      alert(
        "Fehler beim PDF Upload"
      );
    }

    setLoading(false);
  }

  async function deletePlan() {
    const confirmDelete =
      confirm(
        `Plan von ${selectedDriver} löschen?`
      );

    if (!confirmDelete) return;

    const snapshot =
      await getDocs(
        collection(db, "touren")
      );

    for (const documentData of snapshot.docs) {
      const data =
        documentData.data();

      if (
        data.fahrer ===
        selectedDriver
      ) {
        await deleteDoc(
          doc(
            db,
            "touren",
            documentData.id
          )
        );
      }
    }

    await loadTour();

    alert("Plan gelöscht");
  }

  async function resetStatuses() {
    const snapshot =
      await getDocs(
        collection(db, "touren")
      );

    for (const documentData of snapshot.docs) {
      await updateDoc(
        doc(
          db,
          "touren",
          documentData.id
        ),
        {
          status: "",
          deliveredDate: "",
          deliveredTime: "",
        }
      );
    }

    await loadTour();

    alert(
      "Status erfolgreich zurückgesetzt"
    );
  }

  const offene =
    tour.filter(
      (stop) => !stop.status
    );

  const geliefert =
    tour.filter(
      (stop) =>
        stop.status ===
        "Geliefert"
    );

  const nachbar =
    tour.filter(
      (stop) =>
        stop.status ===
        "Beim Nachbarn"
    );

  const tuer =
    tour.filter(
      (stop) =>
        stop.status ===
        "Vor die Tür"
    );

  const falsch =
    tour.filter(
      (stop) =>
        stop.status ===
        "Falsche Adresse"
    );

  function renderSection(
    title: string,
    items: Stop[],
    color: string
  ) {
    return (
      <div
        style={{
          marginBottom: 30,
        }}
      >
        <h2
          style={{
            color: "white",
            marginBottom: 20,
          }}
        >
          {title} ({items.length})
        </h2>

        {items.map((stop) => (
          <div
            key={stop.id}
            style={{
              background:
                "rgba(255,255,255,0.08)",

              padding: 20,

              borderRadius: 20,

              marginBottom: 15,

              border: `1px solid ${color}`,
            }}
          >
            <h3
              style={{
                color: "white",
                marginBottom: 10,
              }}
            >
              {stop.name}
            </h3>

            <p
              style={{
                color: "#d1d5db",
              }}
            >
              📍{" "}
              {stop.adresse}
            </p>

            {stop.telefon && (
              <p
                style={{
                  color:
                    "#d1d5db",
                }}
              >
                📞{" "}
                {stop.telefon}
              </p>
            )}

            {stop.notiz && (
              <p
                style={{
                  color:
                    "#d1d5db",
                }}
              >
                📝{" "}
                {stop.notiz}
              </p>
            )}

            <p
              style={{
                color,
                fontWeight:
                  "bold",
                marginTop: 10,
              }}
            >
              🚚{" "}
              {stop.fahrer}
            </p>

            {stop.deliveredDate && (
              <p
                style={{
                  color:
                    "#86efac",
                }}
              >
                📅{" "}
                {
                  stop.deliveredDate
                }
              </p>
            )}

            {stop.deliveredTime && (
              <p
                style={{
                  color:
                    "#86efac",
                }}
              >
                ⏰{" "}
                {
                  stop.deliveredTime
                }
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",

        background:
          "linear-gradient(180deg,#020617 0%,#04122b 50%,#020617 100%)",

        padding: 24,

        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <img
          src="/logo.png"
          alt="logo"
          style={{
            width: 180,
            borderRadius: 24,
            marginBottom: 20,
          }}
        />

        <div
          style={{
            background:
              "rgba(15,23,42,0.88)",

            padding: 30,

            borderRadius: 30,

            marginBottom: 30,

            border:
              "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h1
            style={{
              color: "white",
              marginBottom: 25,
              fontSize: 40,
            }}
          >
            Tour Upload
          </h1>

          <select
            value={selectedDriver}
            onChange={(e) =>
              setSelectedDriver(
                e.target.value
              )
            }
            style={{
              width: 320,

              padding: 15,

              borderRadius: 14,

              border: "none",

              marginBottom: 20,

              fontSize: 16,
            }}
          >
            {drivers.map(
              (driver) => (
                <option
                  key={driver}
                  value={driver}
                >
                  {driver}
                </option>
              )
            )}
          </select>

          <br />

          <input
            type="file"
            accept=".pdf"
            onChange={(e) =>
              setFile(
                e.target.files?.[0] ||
                  null
              )
            }
            style={{
              marginBottom: 20,
              color: "white",
            }}
          />

          <div
            style={{
              display: "flex",
              gap: 15,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={uploadPDF}
              disabled={loading}
              style={{
                background:
                  "#2563eb",

                color: "white",

                border: "none",

                padding:
                  "14px 24px",

                borderRadius: 14,

                fontWeight:
                  "bold",
              }}
            >
              {loading
                ? "Lädt..."
                : "PDF automatisch lesen"}
            </button>

            <button
              onClick={resetStatuses}
              style={{
                background:
                  "#22c55e",

                color: "white",

                border: "none",

                padding:
                  "14px 24px",

                borderRadius: 14,

                fontWeight:
                  "bold",
              }}
            >
              Status aktualisieren
            </button>

            <button
              onClick={deletePlan}
              style={{
                background:
                  "#dc2626",

                color: "white",

                border: "none",

                padding:
                  "14px 24px",

                borderRadius: 14,

                fontWeight:
                  "bold",
              }}
            >
              Plan löschen
            </button>
          </div>
        </div>

        {renderSection(
          "⏳ Offen",
          offene,
          "#facc15"
        )}

        {renderSection(
          "✅ Geliefert",
          geliefert,
          "#22c55e"
        )}

        {renderSection(
          "🏠 Nachbar",
          nachbar,
          "#f97316"
        )}

        {renderSection(
          "🚪 Vor die Tür",
          tuer,
          "#3b82f6"
        )}

        {renderSection(
          "❌ Falsche Adresse",
          falsch,
          "#ef4444"
        )}
      </div>
    </main>
  );
}