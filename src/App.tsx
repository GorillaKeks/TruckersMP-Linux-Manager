import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface SystemInfo {
  os: string;
  kernel: string;
  cpu: string;
  memory: string;
  gpu: string;
}

function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSystemInfo = async () => {
    setLoading(true);

    try {
      const info = await invoke<SystemInfo>("get_system_info");
      setSystem(info);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemInfo();
  }, []);

  return (
    <main className="container">
      <header>
        <h1>TruckersMP Linux Manager</h1>
        <p>Linux gaming environment</p>
      </header>

      <section className="card">
        <h2>System</h2>

        {loading ? (
          <p>Detecting system...</p>
        ) : system ? (
          <div className="system-grid">
            <div>
              <span>Operating System</span>
              <strong>{system.os}</strong>
            </div>

            <div>
              <span>Kernel</span>
              <strong>{system.kernel}</strong>
            </div>

            <div>
              <span>CPU</span>
              <strong>{system.cpu}</strong>
            </div>

            <div>
              <span>Memory</span>
              <strong>{system.memory}</strong>
            </div>

            <div>
              <span>GPU</span>
              <strong>{system.gpu}</strong>
            </div>
          </div>
        ) : (
          <p>Unable to detect system information.</p>
        )}

        <button onClick={loadSystemInfo} disabled={loading}>
          {loading ? "Detecting..." : "Refresh"}
        </button>
      </section>
    </main>
  );
}

export default App;