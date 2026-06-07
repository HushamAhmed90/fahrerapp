"use client";

import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useEffect, useState } from "react";

const ADMIN_PASSWORD = "123456";

type Driver = {
  id: string;
  name: string;
  active: boolean;
};

export default function DriversAdminPage() {
  const [allowed, setAllowed] = useState(false);
  

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
 const [loading, setLoading] = useState(false);

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
    }));

    setDrivers(list);
    setLoading(false);
  }

  async function addDriver() {
    if (!name.trim()) return;

    await addDoc(collection(db, "drivers"), {
      name: name.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    });
password: password.trim(),
    setName("");
    loadDrivers();
  }

  async function deleteDriver(id: string) {
    await deleteDoc(doc(db, "drivers", id));
    loadDrivers();
  }

  async function toggleDriver(driver: Driver) {
    await updateDoc(doc(db, "drivers", driver.id), {
      active: !driver.active,
    });

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
      <main style={{ minHeight: "100vh", background: "#111827", color: "white", padding: "30px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "20px" }}>
          Admin Login
        </h1>

        <div style={{ background: "#1f2937", padding: "20px", borderRadius: "12px" }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            style={{ padding: "10px", borderRadius: "8px", marginRight: "10px", color: "black" }}
          />

          <button onClick={loginAdmin} style={{ padding: "10px 16px", borderRadius: "8px", cursor: "pointer" }}>
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#111827", color: "white", padding: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "20px" }}>
          Driver Management
        </h1>

        <button onClick={logoutAdmin} style={{ padding: "10px 16px", borderRadius: "8px", cursor: "pointer" }}>
          Logout
        </button>
      </div>

      <div style={{ background: "#1f2937", padding: "20px", borderRadius: "12px", marginBottom: "20px" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Driver name"
          style={{ padding: "10px", borderRadius: "8px", marginRight: "10px", color: "black" }}
        />
<input
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  placeholder="Driver password"
  style={{
    padding: "10px",
    borderRadius: "8px",
    marginRight: "10px",
    color: "black",
  }}
/>
        <button onClick={addDriver} style={{ padding: "10px 16px", borderRadius: "8px", cursor: "pointer" }}>
          Add Driver
        </button>
      </div>

      <div style={{ background: "#1f2937", padding: "20px", borderRadius: "12px" }}>
        {loading ? (
          <p>Loading...</p>
        ) : drivers.length === 0 ? (
          <p>No drivers found.</p>
        ) : (
          drivers.map((driver) => (
            <div
              key={driver.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                borderBottom: "1px solid #374151",
              }}
            >
              <div>
                <strong>{driver.name}</strong>
                <div style={{ fontSize: "13px", opacity: 0.8 }}>
                  Status: {driver.active ? "Active" : "Inactive"}
                </div>
              </div>

              <div>
                <button onClick={() => toggleDriver(driver)} style={{ padding: "8px 12px", borderRadius: "8px", marginRight: "8px", cursor: "pointer" }}>
                  {driver.active ? "Deactivate" : "Activate"}
                </button>

                <button onClick={() => deleteDriver(driver.id)} style={{ padding: "8px 12px", borderRadius: "8px", cursor: "pointer" }}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}