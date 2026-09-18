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

interface GameInfo {
  name: string;
  installed: boolean;
  path: string | null;
}

interface SteamInfo {
  installed: boolean;
  path: string | null;
  ets2: GameInfo;
  ats: GameInfo;
}

function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [steam, setSteam] = useState<SteamInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);

    try {
      const [systemInfo, steamInfo] = await Promise.all([
        invoke<SystemInfo>("get_system_info"),
        invoke<SteamInfo>("get_steam_info"),
      ]);

      setSystem(systemInfo);
      setSteam(steamInfo);
    } catch (error) {
      console.error("Failed to detect system:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
      </section>

      <section className="card">
        <h2>Steam & Games</h2>

        {loading ? (
          <p>Detecting Steam...</p>
        ) : steam ? (
          <>
            <div className="status-row">
              <span>Steam</span>
              <strong>{steam.installed ? "✓ Detected" : "✗ Not detected"}</strong>
            </div>

            {steam.path && (
              <p className="path">
                {steam.path}
              </p>
            )}

            <div className="game-list">
              <div className="game">
                <div>
                  <span>Euro Truck Simulator 2</span>
                  {steam.ets2.path && (
                    <small>{steam.ets2.path}</small>
                  )}
                </div>
                <strong>
                  {steam.ets2.installed ? "✓ Installed" : "✗ Not installed"}
                </strong>
              </div>

              <div className="game">
                <div>
                  <span>American Truck Simulator</span>
                  {steam.ats.path && (
                    <small>{steam.ats.path}</small>
                  )}
                </div>
                <strong>
                  {steam.ats.installed ? "✓ Installed" : "✗ Not installed"}
                </strong>
              </div>
            </div>
          </>
        ) : (
          <p>Unable to detect Steam.</p>
        )}

        <button onClick={loadData} disabled={loading}>
          {loading ? "Detecting..." : "Refresh"}
        </button>
      </section>
    </main>
  );
}

export default App;