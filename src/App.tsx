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

interface ProcessStatus {
  truckersmp_running: boolean;
  ets2_running: boolean;
}

type Page =
  | "home"
  | "ets2"
  | "ats"
  | "updates"
  | "settings"
  | "logs"
  | "about";

function Status({
  ok,
  children,
}: {
  ok: boolean;
  children: string;
}) {
  return (
    <span className={ok ? "status status-ok" : "status status-error"}>
      <span className="status-dot">
        {ok ? "✓" : "!"}
      </span>
      {children}
    </span>
  );
}

function App() {
  const [page, setPage] = useState<Page>("home");

  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [steam, setSteam] = useState<SteamInfo | null>(null);
  const [truckersMp, setTruckersMp] =
    useState<TruckersMpInfo | null>(null);
  const [processStatus, setProcessStatus] =
    useState<ProcessStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startMessage, setStartMessage] = useState("");

  const loadData = async () => {
    setLoading(true);

    try {
      const [systemInfo, steamInfo, truckersMpInfo, status] =
        await Promise.all([
          invoke<SystemInfo>("get_system_info"),
          invoke<SteamInfo>("get_steam_info"),
          invoke<TruckersMpInfo>("get_truckersmp_info"),
          invoke<ProcessStatus>("get_process_status"),
        ]);

      setSystem(systemInfo);
      setSteam(steamInfo);
      setTruckersMp(truckersMpInfo);
      setProcessStatus(status);
    } catch (error) {
      console.error("Detection failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProcessStatus = async () => {
    try {
      const status =
        await invoke<ProcessStatus>("get_process_status");

      setProcessStatus(status);
    } catch (error) {
      console.error("Process status failed:", error);
    }
  };

  const startTruckersMp = async () => {
    setStarting(true);
    setStartMessage("");

    try {
      const message =
        await invoke<string>("start_truckersmp");

      setStartMessage(message);

      setTimeout(updateProcessStatus, 2000);
    } catch (error) {
      console.error(
        "Failed to start TruckersMP:",
        error,
      );

      setStartMessage(
        `Failed to start TruckersMP: ${error}`,
      );
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(
      updateProcessStatus,
      2000,
    );

    return () => clearInterval(interval);
  }, []);

  const truckersMpRunning =
    processStatus?.truckersmp_running ?? false;

  const ets2Running =
    processStatus?.ets2_running ?? false;

  const ets2Installed =
    steam?.ets2.installed ?? false;

  const atsInstalled =
    steam?.ats.installed ?? false;

  const systemReady = !!system;
  const steamReady = steam?.installed ?? false;
  const truckersMpReady = truckersMp?.installed ?? false;
  const protonReady =
    truckersMp?.proton_installed ?? false;
  const runtimeReady =
    truckersMp?.steam_runtime_installed ?? false;

  const navigate = (target: Page) => {
    setPage(target);
  };

  const renderPageTitle = () => {
    switch (page) {
      case "ets2":
        return "Euro Truck Simulator 2";
      case "ats":
        return "American Truck Simulator";
      case "updates":
        return "Updates";
      case "settings":
        return "Settings";
      case "logs":
        return "Logs";
      case "about":
        return "About";
      default:
        return "Home";
    }
  };

  const renderPlaceholderPage = () => (
    <div className="page-placeholder card">
      <div className="placeholder-icon">
        {page === "ets2" && "🚛"}
        {page === "ats" && "🚚"}
        {page === "updates" && "↻"}
        {page === "settings" && "⚙"}
        {page === "logs" && "▤"}
        {page === "about" && "ⓘ"}
      </div>

      <h2>{renderPageTitle()}</h2>

      <p>
        This section is currently under development.
      </p>

      <button
        className="secondary-button"
        onClick={() => navigate("home")}
      >
        ← Back to Home
      </button>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">🚛</div>

          <div>
            <strong>TruckersMP</strong>
            <span>Linux Manager</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={
              page === "home"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("home")}
          >
            <span className="nav-icon">⌂</span>
            <span>Home</span>
          </button>

          <button
            className={
              page === "ets2"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("ets2")}
          >
            <span className="nav-icon">🚛</span>
            <span>Euro Truck Simulator 2</span>
          </button>

          <button
            className={
              page === "ats"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("ats")}
          >
            <span className="nav-icon">🚛</span>
            <span>American Truck Simulator</span>
          </button>

          <button
            className={
              page === "updates"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("updates")}
          >
            <span className="nav-icon">↻</span>
            <span>Updates</span>
          </button>

          <button
            className={
              page === "settings"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("settings")}
          >
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </button>

          <button
            className={
              page === "logs"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("logs")}
          >
            <span className="nav-icon">▤</span>
            <span>Logs</span>
          </button>

          <button
            className={
              page === "about"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("about")}
          >
            <span className="nav-icon">ⓘ</span>
            <span>About</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-truck">🚚</div>
          <strong>TRUCKERS<span>MP</span></strong>
          <small>LINUX MANAGER</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>TruckersMP Linux Manager</h1>
            <p>Play Together. Anywhere. On Linux.</p>
          </div>

          <div className="header-actions">
            <button
              className="icon-button"
              title="Settings"
              onClick={() => navigate("settings")}
            >
              ⚙
            </button>

            <button
              className="window-button"
              title="Minimize"
            >
              —
            </button>

            <button
              className="window-button"
              title="Maximize"
            >
              □
            </button>

            <button
              className="window-button close"
              title="Close"
            >
              ×
            </button>
          </div>
        </header>

        <div className="content">
          {page !== "home" ? (
            <>
              <div className="page-heading">
                <h2>{renderPageTitle()}</h2>
              </div>

              {renderPlaceholderPage()}
            </>
          ) : (
            <>
              <section className="welcome">
                <div>
                  <h2>Welcome back!</h2>
                  <p>
                    Manage ETS2, ATS and TruckersMP easily on Linux.
                  </p>
                </div>
              </section>

              <section className="game-grid">
                <article className="game-card">
                  <div className="game-card-top">
                    <div className="game-cover ets2-cover">
                      <span>EURO TRUCK</span>
                      <strong>SIMULATOR 2</strong>
                    </div>

                    <div className="game-main">
                      <h2>Euro Truck Simulator 2</h2>

                      <div className="ready-line">
                        <span className="ready-dot" />
                        <strong>
                          {ets2Running
                            ? "Running"
                            : ets2Installed
                              ? "Ready to play"
                              : "Not installed"}
                        </strong>
                      </div>
                    </div>

                    <div className="game-version">
                      <span>Game Version</span>
                      <strong>
                        {ets2Installed
                          ? "Detected"
                          : "—"}
                      </strong>

                      <span>TruckersMP Version</span>
                      <strong>
                        {truckersMpReady
                          ? "Installed"
                          : "—"}
                      </strong>
                    </div>
                  </div>

                  <div className="game-details">
                    <div>
                      <span className="detail-icon">●</span>
                      <span>Steam Installation</span>
                      <strong>
                        {steam?.path ?? "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">▣</span>
                      <span>Game Directory</span>
                      <strong>
                        {truckersMp?.ets2_path ??
                          steam?.ets2.path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">♟</span>
                      <span>TruckersMP</span>
                      <strong>
                        {truckersMpReady
                          ? "Installed"
                          : "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">⚗</span>
                      <span>Proton</span>
                      <strong>
                        {truckersMp?.proton_path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">◈</span>
                      <span>Steam Runtime</span>
                      <strong>
                        {truckersMp?.steam_runtime_path ??
                          "Not detected"}
                      </strong>
                    </div>
                  </div>

                  <div className="game-actions">
                    <button
                      className="primary-button"
                      onClick={startTruckersMp}
                      disabled={
                        loading ||
                        starting ||
                        truckersMpRunning ||
                        !truckersMpReady ||
                        !truckersMp?.ets2_path ||
                        !protonReady ||
                        !runtimeReady
                      }
                    >
                      <span>▶</span>
                      {starting
                        ? "Starting..."
                        : truckersMpRunning
                          ? "TruckersMP Running"
                          : "Start ETS2 (TruckersMP)"}
                    </button>

                    <button className="secondary-button">
                      ↻ Update ETS2
                    </button>

                    <button className="dropdown-button">
                     ⌄
                    </button>
                  </div>
                </article>

                <article className="game-card">
                  <div className="game-card-top">
                    <div className="game-cover ats-cover">
                      <span>AMERICAN</span>
                      <strong>TRUCK SIMULATOR</strong>
                    </div>

                    <div className="game-main">
                      <h2>American Truck Simulator</h2>

                      <div className="ready-line">
                        <span className="ready-dot" />
                        <strong>
                          {atsInstalled
                            ? "Ready to play"
                            : "Not installed"}
                        </strong>
                      </div>
                    </div>

                    <div className="game-version">
                      <span>Game Version</span>
                      <strong>
                        {atsInstalled
                          ? "Detected"
                          : "—"}
                      </strong>

                      <span>TruckersMP Version</span>
                      <strong>
                        {truckersMpReady
                          ? "Installed"
                          : "—"}
                      </strong>
                    </div>
                  </div>

                  <div className="game-details">
                    <div>
                      <span className="detail-icon">●</span>
                      <span>Steam Installation</span>
                      <strong>
                        {steam?.path ?? "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">▣</span>
                      <span>Game Directory</span>
                      <strong>
                        {steam?.ats.path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">♟</span>
                      <span>TruckersMP</span>
                      <strong>
                        {truckersMpReady
                          ? "Installed"
                          : "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">⚗</span>
                      <span>Proton</span>
                      <strong>
                        {truckersMp?.proton_path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">◈</span>
                      <span>Steam Runtime</span>
                      <strong>
                        {truckersMp?.steam_runtime_path ??
                          "Not detected"}
                      </strong>
                    </div>
                  </div>

                  <div className="game-actions">
                    <button
                      className="primary-button"
                      disabled={
                        loading ||
                        !atsInstalled
                      }
                    >
                      <span>▶</span>
                      Start ATS (TruckersMP)
                    </button>

                    <button className="secondary-button">
                      ↻ Update ATS
                    </button>

                    <button className="dropdown-button">
                      ⌄
                    </button>
                  </div>
                </article>
              </section>

              <section className="dashboard-grid">
                <article className="dashboard-card">
                  <div className="card-title">
                    <span className="card-title-icon">
                      ▣
                    </span>
                    <h3>System Information</h3>
                  </div>

                  {loading ? (
                    <p className="muted">
                      Detecting system...
                    </p>
                  ) : system ? (
                    <div className="info-list">
                      <div>
                        <span>Operating System</span>
                        <strong>{system.os}</strong>
                      </div>

                      <div>
                        <span>Kernel</span>
                        <strong>{system.kernel}</strong>
                      </div>

                      <div>
                        <span>GPU</span>
                        <strong>{system.gpu}</strong>
                      </div>

                      <div>
                        <span>CPU</span>
                        <strong>{system.cpu}</strong>
                      </div>

                      <div>
                        <span>RAM</span>
                        <strong>{system.memory}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="muted">
                      Unable to detect system information.
                    </p>
                  )}
                </article>

                <article className="dashboard-card">
                  <div className="card-title">
                    <span className="card-title-icon">
                      ⚙
                    </span>
                    <h3>Components Status</h3>
                  </div>

                  <div className="component-list">
                    <div>
                      <Status ok={steamReady}>
                        Steam
                      </Status>
                      <span>
                        {steamReady
                          ? "Detected"
                          : "Not detected"}
                      </span>
                    </div>

                    <div>
                      <Status ok={truckersMpReady}>
                        TruckersMP CLI
                      </Status>
                      <span>
                        {truckersMpReady
                          ? "Ready"
                          : "Missing"}
                      </span>
                    </div>

                    <div>
                      <Status ok={protonReady}>
                        Proton
                      </Status>
                      <span>
                        {protonReady
                          ? "Ready"
                          : "Missing"}
                      </span>
                    </div>

                    <div>
                      <Status ok={runtimeReady}>
                        Steam Runtime
                      </Status>
                      <span>
                        {runtimeReady
                          ? "Ready"
                          : "Missing"}
                      </span>
                    </div>

                    <div>
                      <Status ok={systemReady}>
                        NVIDIA GPU
                      </Status>
                      <span>
                        {systemReady
                          ? "Ready"
                          : "Unknown"}
                      </span>
                    </div>

                    <div>
                      <Status ok={true}>
                        Internet Connection
                      </Status>
                      <span>Connected</span>
                    </div>
                  </div>
                </article>

                <article className="dashboard-card">
                  <div className="card-title">
                    <span className="card-title-icon">
                      🔧
                    </span>
                    <h3>Quick Actions</h3>
                  </div>

                  <div className="quick-actions">
                    <button onClick={loadData}>
                      ↻
                      <span>Check for Updates</span>
                    </button>

                    <button
                      onClick={() => {
                        if (steam?.ets2.path) {
                          console.log(
                            "Game directory:",
                            steam.ets2.path,
                          );
                        }
                      }}
                    >
                      ▣
                      <span>Open Game Directory</span>
                    </button>

                    <button
                      onClick={() => navigate("logs")}
                    >
                      ▤
                      <span>Open Log Directory</span>
                    </button>

                    <button
                      onClick={() => navigate("settings")}
                    >
                      ⚙
                      <span>Settings</span>
                    </button>
                  </div>
                </article>
              </section>

              <section className="log-card">
                <div className="log-header">
                  <div className="card-title">
                    <span className="card-title-icon">
                      ▤
                    </span>
                    <h3>Log Output</h3>
                  </div>

                  <div className="log-actions">
                    <button
                      onClick={() =>
                        setStartMessage("")
                      }
                    >
                      ♲ Clear
                    </button>

                    <button>⌄</button>
                  </div>
                </div>

                <div className="log-output">
                  <p>
                    <span>[SYSTEM]</span>{" "}
                    TruckersMP Linux Manager started
                  </p>

                  <p>
                    <span>[SYSTEM]</span>{" "}
                    Checking system...
                  </p>

                  {system && (
                    <p>
                      <span>[GPU]</span>{" "}
                      NVIDIA GPU detected: {system.gpu}
                    </p>
                  )}

                  {steam?.installed && (
                    <p>
                      <span>[STEAM]</span>{" "}
                      Steam installation found:{" "}
                      {steam.path}
                    </p>
                  )}

                  {ets2Installed && (
                    <p>
                      <span>[ETS2]</span>{" "}
                      Euro Truck Simulator 2 detected
                    </p>
                  )}

                  {atsInstalled && (
                    <p>
                      <span>[ATS]</span>{" "}
                      American Truck Simulator detected
                    </p>
                  )}

                  {truckersMpReady &&
                    protonReady &&
                    runtimeReady && (
                      <p className="log-success">
                        <span>[READY]</span>{" "}
                        All systems ready!
                      </p>
                    )}

                  {startMessage && (
                    <p className="log-success">
                      <span>[TRUCKERSMP]</span>{" "}
                      {startMessage}
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="footer">
          <span>v1.0.0</span>
          <span>
            Made with ❤️ for the TruckersMP community
          </span>
          <span>Play Together. Drive Further.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;