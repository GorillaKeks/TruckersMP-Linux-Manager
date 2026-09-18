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

function Status({ ok, children }: { ok: boolean; children: string }) {
  return (
    <strong className={ok ? "status-ok" : "status-error"}>
      {ok ? "✓ " : "✗ "}
      {children}
    </strong>
  );
}

function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [steam, setSteam] = useState<SteamInfo | null>(null);
  const [truckersMp, setTruckersMp] = useState<TruckersMpInfo | null>(null);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startMessage, setStartMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setStartMessage("");

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

  const startTruckersMp = async () => {
    setStarting(true);
    setStartMessage("");

    try {
      const message = await invoke<string>("start_truckersmp");
      setStartMessage(message);
    } catch (error) {
      console.error("Failed to start TruckersMP:", error);
      setStartMessage(`Failed to start TruckersMP: ${error}`);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="container">
      <header>
        <h1>TruckersMP Linux Manager</h1>
        <p>Manage TruckersMP on Linux</p>
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
              <Status ok={steam.installed}>
                {steam.installed ? "Detected" : "Not detected"}
              </Status>
            </div>

            {steam.path && <p className="path">{steam.path}</p>}

            {steam.libraries.length > 0 && (
              <div className="libraries">
                <span>Steam Libraries</span>

                {steam.libraries.map((library) => (
                  <small key={library}>{library}</small>
                ))}
              </div>
            )}

            <div className="game-list">
              <div className="game">
                <div>
                  <span>Euro Truck Simulator 2</span>

                  {steam.ets2.path && (
                    <small>{steam.ets2.path}</small>
                  )}
                </div>

                <Status ok={steam.ets2.installed}>
                  {steam.ets2.installed
                    ? "Installed"
                    : "Not installed"}
                </Status>
              </div>

              <div className="game">
                <div>
                  <span>American Truck Simulator</span>

                  {steam.ats.path && (
                    <small>{steam.ats.path}</small>
                  )}
                </div>

                <Status ok={steam.ats.installed}>
                  {steam.ats.installed
                    ? "Installed"
                    : "Not installed"}
                </Status>
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
          <>
            <div className="game-list">
              <div className="game">
                <div>
                  <span>TruckersMP</span>

                  {truckersMp.path && (
                    <small>{truckersMp.path}</small>
                  )}
                </div>

                <Status ok={truckersMp.installed}>
                  {truckersMp.installed
                    ? "Detected"
                    : "Not detected"}
                </Status>
              </div>

              <div className="game">
                <div>
                  <span>TruckersMP ETS2</span>

                  {truckersMp.ets2_path && (
                    <small>{truckersMp.ets2_path}</small>
                  )}
                </div>

                <Status ok={!!truckersMp.ets2_path}>
                  {truckersMp.ets2_path
                    ? "Detected"
                    : "Not detected"}
                </Status>
              </div>

              <div className="game">
                <div>
                  <span>Proton</span>

                  {truckersMp.proton_path && (
                    <small>{truckersMp.proton_path}</small>
                  )}
                </div>

                <Status ok={truckersMp.proton_installed}>
                  {truckersMp.proton_installed
                    ? "Detected"
                    : "Not detected"}
                </Status>
              </div>

              <div className="game">
                <div>
                  <span>Steam Runtime</span>

                  {truckersMp.steam_runtime_path && (
                    <small>{truckersMp.steam_runtime_path}</small>
                  )}
                </div>

                <Status ok={truckersMp.steam_runtime_installed}>
                  {truckersMp.steam_runtime_installed
                    ? "Detected"
                    : "Not detected"}
                </Status>
              </div>
            </div>

            <div className="button-row">
              <button
                onClick={loadData}
                disabled={loading || starting}
              >
                {loading ? "Detecting..." : "Refresh"}
              </button>

              <button
                onClick={startTruckersMp}
                disabled={
                  loading ||
                  starting ||
                  !truckersMp.installed ||
                  !truckersMp.ets2_path ||
                  !truckersMp.proton_installed ||
                  !truckersMp.steam_runtime_installed
                }
              >
                {starting ? "Starting..." : "Start TruckersMP"}
              </button>
            </div>

            {startMessage && (
              <p className="start-message">
                {startMessage}
              </p>
            )}
          </>
        ) : (
          <p>Unable to detect TruckersMP.</p>
        )}
      </section>
    </main>
  );
}

export default App;