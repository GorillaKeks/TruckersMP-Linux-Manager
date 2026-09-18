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
  libraries: string[];
  ets2: GameInfo;
  ats: GameInfo;
}

interface TruckersMpInfo {
  installed: boolean;
  path: string | null;
  ets2_path: string | null;
  proton_installed: boolean;
  proton_path: string | null;
  steam_runtime_installed: boolean;
  steam_runtime_path: string | null;
}

function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [steam, setSteam] = useState<SteamInfo | null>(null);
  const [truckersMp, setTruckersMp] = useState<TruckersMpInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);

    try {
      const [systemInfo, steamInfo, truckersMpInfo] = await Promise.all([
        invoke<SystemInfo>("get_system_info"),
        invoke<SteamInfo>("get_steam_info"),
        invoke<TruckersMpInfo>("get_truckersmp_info"),
      ]);

      setSystem(systemInfo);
      setSteam(steamInfo);
      setTruckersMp(truckersMpInfo);
    } catch (error) {
      console.error("Detection failed:", error);
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
              <strong>
                {steam.installed ? "✓ Detected" : "✗ Not detected"}
              </strong>
            </div>

            {steam.path && <p className="path">{steam.path}</p>}

            <div className="game-list">
              <div className="game">
                <div>
                  <span>Euro Truck Simulator 2</span>
                  {steam.ets2.path && <small>{steam.ets2.path}</small>}
                </div>

                <strong>
                  {steam.ets2.installed
                    ? "✓ Installed"
                    : "✗ Not installed"}
                </strong>
              </div>

              <div className="game">
                <div>
                  <span>American Truck Simulator</span>
                  {steam.ats.path && <small>{steam.ats.path}</small>}
                </div>

                <strong>
                  {steam.ats.installed
                    ? "✓ Installed"
                    : "✗ Not installed"}
                </strong>
              </div>
            </div>
          </>
        ) : (
          <p>Unable to detect Steam.</p>
        )}
      </section>

      <section className="card">
        <h2>TruckersMP</h2>

        {loading ? (
          <p>Detecting TruckersMP...</p>
        ) : truckersMp ? (
          <div className="game-list">
            <div className="game">
              <div>
                <span>TruckersMP</span>
                {truckersMp.path && (
                  <small>{truckersMp.path}</small>
                )}
              </div>

              <strong>
                {truckersMp.installed
                  ? "✓ Detected"
                  : "✗ Not detected"}
              </strong>
            </div>

            <div className="game">
              <div>
                <span>TruckersMP ETS2</span>
                {truckersMp.ets2_path && (
                  <small>{truckersMp.ets2_path}</small>
                )}
              </div>

              <strong>
                {truckersMp.ets2_path
                  ? "✓ Detected"
                  : "✗ Not detected"}
              </strong>
            </div>

            <div className="game">
              <div>
                <span>Proton</span>
                {truckersMp.proton_path && (
                  <small>{truckersMp.proton_path}</small>
                )}
              </div>

              <strong>
                {truckersMp.proton_installed
                  ? "✓ Detected"
                  : "✗ Not detected"}
              </strong>
            </div>

            <div className="game">
              <div>
                <span>Steam Runtime</span>
                {truckersMp.steam_runtime_path && (
                  <small>{truckersMp.steam_runtime_path}</small>
                )}
              </div>

              <strong>
                {truckersMp.steam_runtime_installed
                  ? "✓ Detected"
                  : "✗ Not detected"}
              </strong>
            </div>
          </div>
        ) : (
          <p>Unable to detect TruckersMP.</p>
        )}

        <button onClick={loadData} disabled={loading}>
          {loading ? "Detecting..." : "Refresh"}
        </button>
      </section>
    </main>
  );
}

export default App;
