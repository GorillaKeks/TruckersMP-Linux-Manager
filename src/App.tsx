import {
  useEffect,
  useState,
} from "react";
import {
  invoke,
} from "@tauri-apps/api/core";
import {
  listen,
} from "@tauri-apps/api/event";
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
  ats_path: string | null;
  proton_installed: boolean;
  proton_path: string | null;
  steam_runtime_installed: boolean;
  steam_runtime_path: string | null;
}

interface ProcessStatus {
  truckersmp_running: boolean;
  ets2_running: boolean;
  ats_running: boolean;
}

type Page =
  | "home"
  | "ets2"
  | "ats"
  | "updates"
  | "settings"
  | "logs"
  | "about";

interface LogEntry {
  time: string;
  message: string;
  success?: boolean;
}

function Status({
  ok,
  children,
}: {
  ok: boolean;
  children: string;
}) {
  return (
    <span
      className={
        ok
          ? "status status-ok"
          : "status status-error"
      }
    >
      <span className="status-dot">
        {ok ? "✓" : "!"}
      </span>

      {children}
    </span>
  );
}

function App() {
  const [page, setPage] =
    useState<Page>("home");

  const [system, setSystem] =
    useState<SystemInfo | null>(null);

  const [steam, setSteam] =
    useState<SteamInfo | null>(null);

  const [truckersMp, setTruckersMp] =
    useState<TruckersMpInfo | null>(null);

  const [processStatus, setProcessStatus] =
    useState<ProcessStatus | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [installing, setInstalling] =
    useState(false);

  const [startingGame, setStartingGame] =
    useState<"ets2" | "ats" | null>(null);

  const [message, setMessage] =
    useState("");

  const [logs, setLogs] =
    useState<LogEntry[]>([]);

  const addLog = (
    entry: string,
    success = false,
  ) => {
    const now =
      new Date().toLocaleTimeString(
        "de-DE",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      );

    setLogs((current) => [
      ...current.slice(-199),
      {
        time: now,
        message: entry,
        success,
      },
    ]);
  };

  const loadData = async () => {
    try {
      const [
        systemInfo,
        steamInfo,
        truckersMpInfo,
        status,
      ] = await Promise.all([
        invoke<SystemInfo>(
          "get_system_info",
        ),
        invoke<SteamInfo>(
          "get_steam_info",
        ),
        invoke<TruckersMpInfo>(
          "get_truckersmp_info",
        ),
        invoke<ProcessStatus>(
          "get_process_status",
        ),
      ]);

      setSystem(systemInfo);
      setSteam(steamInfo);
      setTruckersMp(truckersMpInfo);
      setProcessStatus(status);

      addLog(
        "System information refreshed successfully.",
        true,
      );
    } catch (error) {
      console.error(
        "Detection failed:",
        error,
      );

      addLog(
        `Detection failed: ${error}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const updateProcessStatus =
    async () => {
      try {
        const status =
          await invoke<ProcessStatus>(
            "get_process_status",
          );

        setProcessStatus(status);
      } catch (error) {
        console.error(
          "Process status failed:",
          error,
        );
      }
    };

  const installTruckersMpCli =
    async () => {
      if (installing) {
        return;
      }

      setInstalling(true);
      setMessage("");

      addLog(
        "Starting TruckersMP CLI installation...",
      );

      try {
        const result =
          await invoke<string>(
            "install_truckersmp_cli",
          );

        setMessage(result);

        addLog(
          result,
          true,
        );

        await loadData();
      } catch (error) {
        const text =
          `TruckersMP CLI installation failed: ${error}`;

        setMessage(text);
        addLog(text);
      } finally {
        setInstalling(false);
      }
    };

  const startGame = async (
    game: "ets2" | "ats",
  ) => {
    if (startingGame) {
      return;
    }

    setStartingGame(game);
    setMessage("");

    addLog(
      game === "ets2"
        ? "Starting ETS2 through TruckersMP..."
        : "Starting ATS through TruckersMP...",
    );

    try {
      const result =
        await invoke<string>(
          game === "ets2"
            ? "start_truckersmp"
            : "start_ats_truckersmp",
        );

      setMessage(result);

      addLog(
        result,
        true,
      );

      setTimeout(
        updateProcessStatus,
        2000,
      );
    } catch (error) {
      const text =
        `Failed to start ${
          game === "ets2"
            ? "ETS2"
            : "ATS"
        }: ${error}`;

      setMessage(text);
      addLog(text);
    } finally {
      setStartingGame(null);
    }
  };

  const openGameDirectory =
    async (
      path: string | null,
      gameName: string,
    ) => {
      if (!path) {
        addLog(
          `${gameName} game directory is not available.`,
        );
        return;
      }

      addLog(
        `Opening ${gameName} game directory...`,
      );

      try {
        const result =
          await invoke<string>(
            "open_game_directory",
            {
              path,
            },
          );

        addLog(
          result,
          true,
        );
      } catch (error) {
        addLog(
          `Failed to open ${gameName} directory: ${error}`,
        );
      }
    };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let unlistenLog: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let active = true;

    const setupTruckersMpListeners =
      async () => {
        const logListener =
          await listen<string>(
            "truckersmp-log",
            (event) => {
              addLog(event.payload);
            },
          );

        if (!active) {
          logListener();
          return;
        }

        unlistenLog = logListener;

        const exitListener =
          await listen<string>(
            "truckersmp-exit",
            (event) => {
              addLog(event.payload);
              setStartingGame(null);
              updateProcessStatus();
            },
          );

        if (!active) {
          exitListener();
          return;
        }

        unlistenExit = exitListener;
      };

    setupTruckersMpListeners();

    return () => {
      active = false;
      unlistenLog?.();
      unlistenExit?.();
    };
  }, []);

  useEffect(() => {
    const interval =
      setInterval(
        updateProcessStatus,
        2000,
      );

    return () =>
      clearInterval(interval);
  }, []);

  const steamReady =
    steam?.installed ?? false;

  const truckersMpReady =
    truckersMp?.installed ?? false;

  const protonReady =
    truckersMp?.proton_installed ??
    false;

  const runtimeReady =
    truckersMp?.steam_runtime_installed ??
    false;

  const ets2Installed =
    steam?.ets2.installed ?? false;

  const atsInstalled =
    steam?.ats.installed ?? false;

  const ets2Running =
    processStatus?.ets2_running ??
    false;

  const atsRunning =
    processStatus?.ats_running ??
    false;

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

  const renderPlaceholder =
    () => (
      <div className="page-placeholder card">
        <div className="placeholder-icon">
          {page === "ets2" && "🚛"}
          {page === "ats" && "🚚"}
          {page === "updates" && "↻"}
          {page === "settings" && "⚙"}
          {page === "logs" && "▤"}
          {page === "about" && "ⓘ"}
        </div>

        <h2>
          {renderPageTitle()}
        </h2>

        <p>
          This section is currently
          under development.
        </p>

        <button
          className="secondary-button"
          onClick={() =>
            setPage("home")
          }
        >
          ← Back to Home
        </button>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            🚛
          </div>

          <div>
            <strong>
              TruckersMP
            </strong>

            <span>
              Linux Manager
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {(
            [
              ["home", "⌂", "Home"],
              [
                "ets2",
                "🚛",
                "Euro Truck Simulator 2",
              ],
              [
                "ats",
                "🚚",
                "American Truck Simulator",
              ],
              ["updates", "↻", "Updates"],
              ["settings", "⚙", "Settings"],
              ["logs", "▤", "Logs"],
              ["about", "ⓘ", "About"],
            ] as [
              Page,
              string,
              string,
            ][]
          ).map(
            ([
              target,
              icon,
              label,
            ]) => (
              <button
                key={target}
                className={
                  page === target
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setPage(target)
                }
              >
                <span className="nav-icon">
                  {icon}
                </span>

                <span>
                  {label}
                </span>
              </button>
            ),
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-truck">
            🚚
          </div>

          <strong>
            TRUCKERS<span>MP</span>
          </strong>

          <small>
            LINUX MANAGER
          </small>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>
              TruckersMP Linux Manager
            </h1>

            <p>
              Play Together. Anywhere.
              On Linux.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="icon-button"
              title="Settings"
              onClick={() =>
                setPage("settings")
              }
            >
              ⚙
            </button>
          </div>
        </header>

        <div className="content">
          {page !== "home" ? (
            <>
              <div className="page-heading">
                <h2>
                  {renderPageTitle()}
                </h2>
              </div>

              {renderPlaceholder()}
            </>
          ) : (
            <>
              <section className="welcome">
                <div>
                  <h2>
                    Welcome back!
                  </h2>

                  <p>
                    Manage ETS2, ATS and
                    TruckersMP easily on
                    Linux.
                  </p>
                </div>
              </section>

              <section className="game-grid">
                <article className="game-card">
                  <div className="game-card-top">
                    <div className="game-cover ets2-cover">
                      <span>
                        EURO TRUCK
                      </span>

                      <strong>
                        SIMULATOR 2
                      </strong>
                    </div>

                    <div className="game-main">
                      <h2>
                        Euro Truck Simulator 2
                      </h2>

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
                      <span>
                        Game Version
                      </span>

                      <strong>
                        {ets2Installed
                          ? "Detected"
                          : "—"}
                      </strong>

                      <span>
                        TruckersMP
                      </span>

                      <strong>
                        {truckersMpReady
                          ? "Ready"
                          : "Missing"}
                      </strong>
                    </div>
                  </div>

                  <div className="game-details">
                    <div>
                      <span className="detail-icon">
                        ●
                      </span>

                      <span>
                        Steam Installation
                      </span>

                      <strong>
                        {steam?.path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">
                        ▣
                      </span>

                      <span>
                        Game Directory
                      </span>

                      <strong>
                        {truckersMp?.ets2_path ??
                          steam?.ets2.path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">
                        ♟
                      </span>

                      <span>
                        TruckersMP CLI
                      </span>

                      <strong>
                        {truckersMp?.path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">
                        ⚗
                      </span>

                      <span>
                        Proton
                      </span>

                      <strong>
                        {truckersMp?.proton_path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">
                        ◈
                      </span>

                      <span>
                        Steam Runtime
                      </span>

                      <strong>
                        {truckersMp?.steam_runtime_path ??
                          "Not detected"}
                      </strong>
                    </div>
                  </div>

                  <div className="game-actions">
                    <button
                      className="primary-button"
                      onClick={() =>
                        startGame("ets2")
                      }
                      disabled={
                        loading ||
                        installing ||
                        !truckersMpReady ||
                        !ets2Installed ||
                        startingGame !== null ||
                        ets2Running
                      }
                    >
                      <span>
                        ▶
                      </span>

                      {startingGame ===
                      "ets2"
                        ? "Starting..."
                        : ets2Running
                          ? "ETS2 Running"
                          : "Start ETS2 (TruckersMP)"}
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() =>
                        openGameDirectory(
                          truckersMp?.ets2_path ??
                            steam?.ets2.path ??
                            null,
                          "ETS2",
                        )
                      }
                      disabled={
                        !(
                          truckersMp?.ets2_path ??
                          steam?.ets2.path
                        )
                      }
                    >
                      📁 Game Directory
                    </button>
                  </div>
                </article>

                <article className="game-card">
                  <div className="game-card-top">
                    <div className="game-cover ats-cover">
                      <span>
                        AMERICAN
                      </span>

                      <strong>
                        TRUCK SIMULATOR
                      </strong>
                    </div>

                    <div className="game-main">
                      <h2>
                        American Truck Simulator
                      </h2>

                      <div className="ready-line">
                        <span className="ready-dot" />

                        <strong>
                          {atsRunning
                            ? "Running"
                            : atsInstalled
                              ? "Ready to play"
                              : "Not installed"}
                        </strong>
                      </div>
                    </div>

                    <div className="game-version">
                      <span>
                        Game Version
                      </span>

                      <strong>
                        {atsInstalled
                          ? "Detected"
                          : "—"}
                      </strong>

                      <span>
                        TruckersMP
                      </span>

                      <strong>
                        {truckersMpReady
                          ? "Ready"
                          : "Missing"}
                      </strong>
                    </div>
                  </div>

                  <div className="game-details">
                    <div>
                      <span className="detail-icon">
                        ●
                      </span>

                      <span>
                        Steam Installation
                      </span>

                      <strong>
                        {steam?.path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">
                        ▣
                      </span>

                      <span>
                        Game Directory
                      </span>

                      <strong>
                        {truckersMp?.ats_path ??
                          steam?.ats.path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">
                        ♟
                      </span>

                      <span>
                        TruckersMP CLI
                      </span>

                      <strong>
                        {truckersMp?.path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">
                        ⚗
                      </span>

                      <span>
                        Proton
                      </span>

                      <strong>
                        {truckersMp?.proton_path ??
                          "Not detected"}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-icon">
                        ◈
                      </span>

                      <span>
                        Steam Runtime
                      </span>

                      <strong>
                        {truckersMp?.steam_runtime_path ??
                          "Not detected"}
                      </strong>
                    </div>
                  </div>

                  <div className="game-actions">
                    <button
                      className="primary-button"
                      onClick={() =>
                        startGame("ats")
                      }
                      disabled={
                        loading ||
                        installing ||
                        !truckersMpReady ||
                        !atsInstalled ||
                        startingGame !== null ||
                        atsRunning
                      }
                    >
                      <span>
                        ▶
                      </span>

                      {startingGame ===
                      "ats"
                        ? "Starting..."
                        : atsRunning
                          ? "ATS Running"
                          : "Start ATS (TruckersMP)"}
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() =>
                        openGameDirectory(
                          truckersMp?.ats_path ??
                            steam?.ats.path ??
                            null,
                          "ATS",
                        )
                      }
                      disabled={
                        !(
                          truckersMp?.ats_path ??
                          steam?.ats.path
                        )
                      }
                    >
                      📁 Game Directory
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

                    <h3>
                      System Information
                    </h3>
                  </div>

                  {loading ? (
                    <p className="muted">
                      Detecting system...
                    </p>
                  ) : system ? (
                    <div className="info-list">
                      <div>
                        <span>
                          Operating System
                        </span>

                        <strong>
                          {system.os}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Kernel
                        </span>

                        <strong>
                          {system.kernel}
                        </strong>
                      </div>

                      <div>
                        <span>
                          CPU
                        </span>

                        <strong>
                          {system.cpu}
                        </strong>
                      </div>

                      <div>
                        <span>
                          RAM
                        </span>

                        <strong>
                          {system.memory}
                        </strong>
                      </div>

                      <div>
                        <span>
                          GPU
                        </span>

                        <strong>
                          {system.gpu}
                        </strong>
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

                    <h3>
                      Components Status
                    </h3>
                  </div>

                  <div className="component-list">
                    <div>
                      <Status ok={steamReady}>
                        Steam
                      </Status>

                      <span>
                        {steamReady
                          ? "Detected"
                          : "Missing"}
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
                      <Status
                        ok={
                          !!system?.gpu &&
                          system.gpu !==
                            "Unknown"
                        }
                      >
                        GPU
                      </Status>

                      <span>
                        {system?.gpu &&
                        system.gpu !==
                          "Unknown"
                          ? "Detected"
                          : "Unknown"}
                      </span>
                    </div>

                    <div>
                      <Status ok={true}>
                        Manager
                      </Status>

                      <span>
                        Running
                      </span>
                    </div>
                  </div>

                  {!truckersMpReady && (
                    <button
                      className="install-button"
                      onClick={
                        installTruckersMpCli
                      }
                      disabled={
                        installing
                      }
                    >
                      {installing
                        ? "Installing..."
                        : "Install TruckersMP CLI"}
                    </button>
                  )}
                </article>

                <article className="dashboard-card">
                  <div className="card-title">
                    <span className="card-title-icon">
                      🔧
                    </span>

                    <h3>
                      Quick Actions
                    </h3>
                  </div>

                  <div className="quick-actions">
                    <button
                      onClick={loadData}
                    >
                      ↻
                      <span>
                        Refresh Detection
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        openGameDirectory(
                          truckersMp?.ets2_path ??
                            steam?.ets2.path ??
                            null,
                          "ETS2",
                        )
                      }
                    >
                      📁
                      <span>
                        Open ETS2 Directory
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        openGameDirectory(
                          truckersMp?.ats_path ??
                            steam?.ats.path ??
                            null,
                          "ATS",
                        )
                      }
                    >
                      📁
                      <span>
                        Open ATS Directory
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        setPage("settings")
                      }
                    >
                      ⚙
                      <span>
                        Settings
                      </span>
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

                    <h3>
                      Log Output
                    </h3>
                  </div>

                  <div className="log-actions">
                    <button
                      onClick={() =>
                        setLogs([])
                      }
                    >
                      ♲ Clear
                    </button>
                  </div>
                </div>

                <div className="log-output">
                  {logs.length === 0 ? (
                    <p>
                      <span>
                        [SYSTEM]
                      </span>{" "}
                      No log entries.
                    </p>
                  ) : (
                    logs.map(
                      (
                        entry,
                        index,
                      ) => (
                        <p
                          key={`${entry.time}-${index}`}
                          className={
                            entry.success
                              ? "log-success"
                              : undefined
                          }
                        >
                          <span>
                            [{entry.time}]
                          </span>{" "}
                          {entry.message}
                        </p>
                      ),
                    )
                  )}

                  {message && (
                    <p className="log-success">
                      <span>
                        [MESSAGE]
                      </span>{" "}
                      {message}
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="footer">
          <span>
            v1.0.0
          </span>

          <span>
            Made with ❤️ for the TruckersMP community
          </span>

          <span>
            Play Together. Drive Further.
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
