use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::thread;
use tauri::Emitter;

/* ==================================================
   DATA TYPES
================================================== */

#[derive(Serialize)]
struct SystemInfo {
    os: String,
    kernel: String,
    cpu: String,
    memory: String,
    gpu: String,
}

#[derive(Serialize)]
struct GameInfo {
    name: String,
    installed: bool,
    path: Option<String>,
}

#[derive(Serialize)]
struct SteamInfo {
    installed: bool,
    path: Option<String>,
    libraries: Vec<String>,
    ets2: GameInfo,
    ats: GameInfo,
}

#[derive(Serialize)]
struct TruckersMpInfo {
    installed: bool,
    path: Option<String>,

    // TruckersMP-managed game directories.
    ets2_path: Option<String>,
    ats_path: Option<String>,

    proton_installed: bool,
    proton_path: Option<String>,

    steam_runtime_installed: bool,
    steam_runtime_path: Option<String>,
}

#[derive(Serialize)]
struct ProcessStatus {
    truckersmp_running: bool,
    ets2_running: bool,
    ats_running: bool,
}

/* ==================================================
   GENERAL HELPERS
================================================== */

fn home_dir() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn path_to_string(path: Option<PathBuf>) -> Option<String> {
    path.map(|value| value.to_string_lossy().to_string())
}

fn find_existing_path(candidates: &[PathBuf]) -> Option<PathBuf> {
    candidates.iter().find(|path| path.exists()).cloned()
}

fn command_output(command: &str, args: &[&str]) -> String {
    Command::new(command)
        .args(args)
        .output()
        .ok()
        .and_then(|output| {
            if !output.status.success() {
                return None;
            }

            let value = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();

            if value.is_empty() {
                None
            } else {
                Some(value)
            }
        })
        .unwrap_or_else(|| "Unknown".to_string())
}

/* ==================================================
   MANAGER / TRUCKERSMP CLI
================================================== */

fn manager_dir() -> PathBuf {
    home_dir()
        .join(".local")
        .join("share")
        .join("truckersmp-linux-manager")
}

fn truckersmp_cli_dir() -> PathBuf {
    manager_dir().join("truckersmp-cli")
}

fn truckersmp_cli_venv() -> PathBuf {
    truckersmp_cli_dir().join("venv")
}

fn truckersmp_cli_path() -> PathBuf {
    truckersmp_cli_venv()
        .join("bin")
        .join("truckersmp-cli")
}

fn find_truckersmp_cli() -> Option<PathBuf> {
    let home = home_dir();

    let candidates = [
        truckersmp_cli_path(),

        home.join(".local")
            .join("bin")
            .join("truckersmp-cli"),

        home.join(".local")
            .join("share")
            .join("truckersmp-cli")
            .join("venv")
            .join("bin")
            .join("truckersmp-cli"),

        home.join("truckersmp-cli")
            .join(".venv")
            .join("bin")
            .join("truckersmp-cli"),
    ];

    find_existing_path(&candidates)
}

fn create_python_venv(venv_dir: &Path) -> Result<(), String> {
    if let Some(parent) = venv_dir.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| {
                format!(
                    "Failed to create Python environment directory: {}",
                    error
                )
            })?;
    }

    let status = Command::new("python3")
        .args([
            "-m",
            "venv",
            venv_dir.to_string_lossy().as_ref(),
        ])
        .status()
        .map_err(|error| {
            format!(
                "Failed to create Python virtual environment: {}",
                error
            )
        })?;

    if !status.success() {
        return Err(
            "Could not create Python virtual environment. \
             Please install python3-venv."
                .to_string(),
        );
    }

    Ok(())
}

#[tauri::command]
fn install_truckersmp_cli() -> Result<String, String> {
    let cli_dir = truckersmp_cli_dir();
    let venv_dir = truckersmp_cli_venv();
    let python = venv_dir.join("bin").join("python");

    fs::create_dir_all(&cli_dir)
        .map_err(|error| {
            format!(
                "Failed to create manager directory: {}",
                error
            )
        })?;

    let python_check = Command::new("python3")
        .arg("--version")
        .output()
        .map_err(|error| {
            format!(
                "Python 3 is not available: {}",
                error
            )
        })?;

    if !python_check.status.success() {
        return Err(
            "Python 3 is not available on this system."
                .to_string(),
        );
    }

    let venv_valid =
        python.exists()
            && Command::new(&python)
                .args([
                    "-m",
                    "pip",
                    "--version",
                ])
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false);

    if !venv_valid {
        if venv_dir.exists() {
            fs::remove_dir_all(&venv_dir)
                .map_err(|error| {
                    format!(
                        "Failed to remove broken Python virtual environment: {}",
                        error
                    )
                })?;
        }

        create_python_venv(&venv_dir)?;
    }

    let pip_check = Command::new(&python)
        .args([
            "-m",
            "pip",
            "--version",
        ])
        .output()
        .map_err(|error| {
            format!(
                "Failed to start pip: {}",
                error
            )
        })?;

    if !pip_check.status.success() {
        let stderr = String::from_utf8_lossy(
            &pip_check.stderr,
        )
        .trim()
        .to_string();

        return Err(format!(
            "pip is not available in the virtual environment.{}",
            if stderr.is_empty() {
                String::new()
            } else {
                format!("\n\n{}", stderr)
            }
        ));
    }

    let install = Command::new(&python)
        .args([
            "-m",
            "pip",
            "install",
            "--upgrade",
            "truckersmp-cli",
        ])
        .output()
        .map_err(|error| {
            format!(
                "Failed to execute pip: {}",
                error
            )
        })?;

    if !install.status.success() {
        let stdout = String::from_utf8_lossy(
            &install.stdout,
        )
        .trim()
        .to_string();

        let stderr = String::from_utf8_lossy(
            &install.stderr,
        )
        .trim()
        .to_string();

        let details = if !stderr.is_empty() {
            stderr
        } else {
            stdout
        };

        return Err(format!(
            "truckersmp-cli installation failed.{}",
            if details.is_empty() {
                String::new()
            } else {
                format!("\n\n{}", details)
            }
        ));
    }

    let cli = truckersmp_cli_path();

    if !cli.exists() {
        return Err(
            "Installation finished, but truckersmp-cli could not be found."
                .to_string(),
        );
    }

    Ok(format!(
        "TruckersMP CLI installed successfully at {}",
        cli.display()
    ))
}

/* ==================================================
   STEAM
================================================== */

fn find_steam_roots(home: &Path) -> Vec<PathBuf> {
    let candidates = [
        home.join(".steam")
            .join("debian-installation"),

        home.join(".steam")
            .join("steam"),

        home.join(".local")
            .join("share")
            .join("Steam"),

        home.join(".var")
            .join("app")
            .join("com.valvesoftware.Steam")
            .join(".local")
            .join("share")
            .join("Steam"),
    ];

    candidates
        .iter()
        .filter(|path| path.exists())
        .cloned()
        .collect()
}

fn find_steam_installation(home: &Path) -> Option<PathBuf> {
    find_existing_path(&find_steam_roots(home))
}

fn parse_steam_library_paths(
    vdf_path: &Path,
) -> Vec<PathBuf> {
    let mut libraries = Vec::new();

    let content =
        match fs::read_to_string(vdf_path) {
            Ok(content) => content,
            Err(_) => return libraries,
        };

    for line in content.lines() {
        let line = line.trim();

        if !line.starts_with("\"path\"") {
            continue;
        }

        let parts: Vec<&str> =
            line.split('"').collect();

        if parts.len() < 4 {
            continue;
        }

        let path = PathBuf::from(
            parts[3].replace("\\\\", "\\"),
        );

        if path.exists() {
            libraries.push(path);
        }
    }

    libraries
}

fn find_steam_libraries(home: &Path) -> Vec<PathBuf> {
    let mut libraries = Vec::new();

    for steam_root in find_steam_roots(home) {
        let main_library =
            steam_root.join("steamapps");

        if main_library.exists() {
            libraries.push(main_library);
        }

        let library_vdf = steam_root
            .join("steamapps")
            .join("libraryfolders.vdf");

        for library in
            parse_steam_library_paths(&library_vdf)
        {
            let steamapps =
                library.join("steamapps");

            if steamapps.exists() {
                libraries.push(steamapps);
            }
        }
    }

    libraries.sort();
    libraries.dedup();

    libraries
}

fn find_game(
    libraries: &[PathBuf],
    game_name: &str,
) -> GameInfo {
    for library in libraries {
        let game_path =
            library.join("common").join(game_name);

        if game_path.exists() {
            return GameInfo {
                name: game_name.to_string(),
                installed: true,
                path: Some(
                    game_path
                        .to_string_lossy()
                        .to_string(),
                ),
            };
        }
    }

    GameInfo {
        name: game_name.to_string(),
        installed: false,
        path: None,
    }
}

/* ==================================================
   TRUCKERSMP GAME DATA
================================================== */

fn find_truckersmp_game_dir(
    game: &str,
) -> Option<PathBuf> {
    let home = home_dir();

    let mut candidates = Vec::new();

    match game {
        "ETS2" => {
            candidates.push(
                PathBuf::from(
                    "/mnt/Games/TruckersMP/ETS2",
                ),
            );

            candidates.push(
                PathBuf::from(
                    "/mnt/games/TruckersMP/ETS2",
                ),
            );

            candidates.push(
                home.join("TruckersMP")
                    .join("ETS2"),
            );

            let xdg_data_home =
                env::var_os("XDG_DATA_HOME")
                    .map(PathBuf::from)
                    .unwrap_or_else(|| {
                        home.join(".local")
                            .join("share")
                    });

            candidates.push(
                xdg_data_home
                    .join("truckersmp-cli")
                    .join("Euro Truck Simulator 2")
                    .join("data"),
            );
        }

        "ATS" => {
            candidates.push(
                PathBuf::from(
                    "/mnt/Games/TruckersMP/ATS",
                ),
            );

            candidates.push(
                PathBuf::from(
                    "/mnt/games/TruckersMP/ATS",
                ),
            );

            candidates.push(
                home.join("TruckersMP")
                    .join("ATS"),
            );

            let xdg_data_home =
                env::var_os("XDG_DATA_HOME")
                    .map(PathBuf::from)
                    .unwrap_or_else(|| {
                        home.join(".local")
                            .join("share")
                    });

            candidates.push(
                xdg_data_home
                    .join("truckersmp-cli")
                    .join("American Truck Simulator")
                    .join("data"),
            );
        }

        _ => {}
    }

    find_existing_path(&candidates)
}

/* ==================================================
   PROTON
================================================== */

fn find_proton_path() -> Option<PathBuf> {
    let home = home_dir();

    let candidates = [
        PathBuf::from(
            "/mnt/Games/TruckersMP/Proton",
        ),

        PathBuf::from(
            "/mnt/games/TruckersMP/Proton",
        ),

        home.join("TruckersMP")
            .join("Proton"),

        home.join(".local")
            .join("share")
            .join("truckersmp-cli")
            .join("Proton"),
    ];

    find_existing_path(&candidates)
}

/* ==================================================
   STEAM RUNTIME
================================================== */

fn find_steam_runtime_path() -> Option<PathBuf> {
    let home = home_dir();

    let candidates = [
        PathBuf::from(
            "/mnt/Games/TruckersMP/SteamRuntime",
        ),

        PathBuf::from(
            "/mnt/games/TruckersMP/SteamRuntime",
        ),

        home.join("TruckersMP")
            .join("SteamRuntime"),

        home.join(".local")
            .join("share")
            .join("truckersmp-cli")
            .join("SteamRuntime"),

        home.join(".steam")
            .join("steam")
            .join("steamapps")
            .join("common")
            .join("SteamLinuxRuntime_sniper"),
    ];

    find_existing_path(&candidates)
}

/* ==================================================
   SYSTEM INFORMATION
================================================== */

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let os =
        fs::read_to_string(
            "/etc/os-release",
        )
        .ok()
        .and_then(|content| {
            content.lines().find_map(
                |line| {
                    line.strip_prefix(
                        "PRETTY_NAME=",
                    )
                    .map(|value| {
                        value
                            .trim_matches('"')
                            .to_string()
                    })
                },
            )
        })
        .unwrap_or_else(|| {
            command_output(
                "uname",
                &["-o"],
            )
        });

    let kernel =
        command_output(
            "uname",
            &["-r"],
        );

    let cpu =
        fs::read_to_string(
            "/proc/cpuinfo",
        )
        .ok()
        .and_then(|content| {
            content.lines().find_map(
                |line| {
                    line.strip_prefix(
                        "model name",
                    )
                    .and_then(|value| {
                        value.split_once(':')
                    })
                    .map(|(_, value)| {
                        value.trim().to_string()
                    })
                },
            )
        })
        .unwrap_or_else(|| {
            "Unknown".to_string()
        });

    let memory =
        fs::read_to_string(
            "/proc/meminfo",
        )
        .ok()
        .map(|content| {
            let total =
                content.lines().find_map(
                    |line| {
                        line.strip_prefix(
                            "MemTotal:",
                        )
                        .and_then(|value| {
                            value
                                .split_whitespace()
                                .next()
                        })
                        .and_then(|value| {
                            value
                                .parse::<u64>()
                                .ok()
                        })
                    },
                )
                .unwrap_or(0);

            let available =
                content.lines().find_map(
                    |line| {
                        line.strip_prefix(
                            "MemAvailable:",
                        )
                        .and_then(|value| {
                            value
                                .split_whitespace()
                                .next()
                        })
                        .and_then(|value| {
                            value
                                .parse::<u64>()
                                .ok()
                        })
                    },
                )
                .unwrap_or(0);

            if total == 0 {
                "Unknown".to_string()
            } else {
                let used =
                    total.saturating_sub(
                        available,
                    );

                format!(
                    "{} MB / {} MB",
                    used / 1024,
                    total / 1024
                )
            }
        })
        .unwrap_or_else(|| {
            "Unknown".to_string()
        });

    let gpu = {
        let nvidia =
            command_output(
                "nvidia-smi",
                &[
                    "--query-gpu=name",
                    "--format=csv,noheader",
                ],
            );

        if nvidia != "Unknown" {
            nvidia
        } else {
            let lspci =
                command_output(
                    "lspci",
                    &[],
                );

            lspci
                .lines()
                .find(|line| {
                    line.contains(
                        "VGA compatible controller",
                    )
                        || line.contains(
                            "3D controller",
                        )
                        || line.contains(
                            "Display controller",
                        )
                })
                .unwrap_or("Unknown")
                .to_string()
        }
    };

    SystemInfo {
        os,
        kernel,
        cpu,
        memory,
        gpu,
    }
}

/* ==================================================
   STEAM INFO
================================================== */

#[tauri::command]
fn get_steam_info() -> SteamInfo {
    let home = home_dir();

    let steam =
        find_steam_installation(&home);

    let libraries =
        find_steam_libraries(&home);

    let library_strings =
        libraries
            .iter()
            .map(|path| {
                path.to_string_lossy()
                    .to_string()
            })
            .collect();

    SteamInfo {
        installed: steam.is_some(),
        path: path_to_string(steam),
        libraries: library_strings,

        ets2: find_game(
            &libraries,
            "Euro Truck Simulator 2",
        ),

        ats: find_game(
            &libraries,
            "American Truck Simulator",
        ),
    }
}

/* ==================================================
   TRUCKERSMP INFO
================================================== */

#[tauri::command]
fn get_truckersmp_info()
    -> TruckersMpInfo
{
    let cli =
        find_truckersmp_cli();

    let ets2 =
        find_truckersmp_game_dir(
            "ETS2",
        );

    let ats =
        find_truckersmp_game_dir(
            "ATS",
        );

    let proton =
        find_proton_path();

    let runtime =
        find_steam_runtime_path();

    TruckersMpInfo {
        installed: cli.is_some(),

        path:
            path_to_string(cli),

        ets2_path:
            path_to_string(ets2),

        ats_path:
            path_to_string(ats),

        proton_installed:
            proton.is_some(),

        proton_path:
            path_to_string(proton),

        steam_runtime_installed:
            runtime.is_some(),

        steam_runtime_path:
            path_to_string(runtime),
    }
}

/* ==================================================
   NVIDIA
================================================== */

fn nvidia_available() -> bool {
    Command::new("nvidia-smi")
        .args([
            "--query-gpu=name",
            "--format=csv,noheader",
        ])
        .output()
        .map(|output| {
            output.status.success()
        })
        .unwrap_or(false)
}

/* ==================================================
   TRUCKERSMP COMMAND BUILDER
================================================== */

fn build_truckersmp_command(
    cli: &Path,
    game_dir: &Path,
    proton: &Path,
    runtime: &Path,
    target: &str,
) -> Command {
    let mut command = Command::new(cli);

    command.arg("-vv");
    command.arg("-n");
    command.arg("pilzsee");

    command.arg("-g");
    command.arg(game_dir);

    command.arg("-o");
    command.arg(proton);

    command.arg("--steamruntimedir");
    command.arg(runtime);

    command.arg("start");
    command.arg(target);

    if nvidia_available() {
        command.env("__NV_PRIME_RENDER_OFFLOAD", "1");
        command.env("__GLX_VENDOR_LIBRARY_NAME", "nvidia");
    }

    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    command
}

fn stream_truckersmp_output(
    mut process: Child,
    app: tauri::AppHandle,
    target: String,
) -> u32 {
    let pid = process.id();

    if let Some(stdout) = process.stdout.take() {
        let app = app.clone();
        let target = target.clone();

        thread::spawn(move || {
            let reader = BufReader::new(stdout);

            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let _ = app.emit("truckersmp-log", line);
                    }
                    Err(error) => {
                        let _ = app.emit(
                            "truckersmp-log",
                            format!("[{}][stdout error] {}", target, error),
                        );
                        break;
                    }
                }
            }
        });
    }

    if let Some(stderr) = process.stderr.take() {
        let app = app.clone();
        let target = target.clone();

        thread::spawn(move || {
            let reader = BufReader::new(stderr);

            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let _ = app.emit("truckersmp-log", line);
                    }
                    Err(error) => {
                        let _ = app.emit(
                            "truckersmp-log",
                            format!("[{}][stderr error] {}", target, error),
                        );
                        break;
                    }
                }
            }
        });
    }

    thread::spawn(move || {
        match process.wait() {
            Ok(status) => {
                let message = format!(
                    "TruckersMP {} process exited with code {}",
                    target,
                    status.code().unwrap_or(-1)
                );

                let _ = app.emit("truckersmp-exit", &message);
                let _ = app.emit("truckersmp-log", format!("[EXIT] {}", message));
            }
            Err(error) => {
                let message = format!(
                    "TruckersMP {} process wait failed: {}",
                    target, error
                );

                let _ = app.emit("truckersmp-exit", message.clone());
                let _ = app.emit(
                    "truckersmp-log",
                    format!("[ERROR] {}", message),
                );
            }
        }
    });

    pid
}


/* ==================================================
   START ETS2
================================================== */

#[tauri::command]
fn start_truckersmp(
    app: tauri::AppHandle,
) -> Result<String, String> {
    let cli = find_truckersmp_cli().ok_or_else(|| {
        "TruckersMP CLI is not installed. Please install it first.".to_string()
    })?;

    let game_dir = find_truckersmp_game_dir("ETS2").ok_or_else(|| {
        "TruckersMP ETS2 game directory was not found. Please update/install ETS2 for TruckersMP first.".to_string()
    })?;

    let proton = find_proton_path().ok_or_else(|| {
        "TruckersMP Proton was not found.".to_string()
    })?;

    let runtime = find_steam_runtime_path().ok_or_else(|| {
        "TruckersMP Steam Runtime was not found.".to_string()
    })?;

    let target = "ets2mp".to_string();

    let _ = app.emit(
        "truckersmp-log",
        "[MANAGER] Starting TruckersMP CLI for ETS2...".to_string(),
    );

    let process = build_truckersmp_command(
        &cli,
        &game_dir,
        &proton,
        &runtime,
        &target,
    )
    .spawn()
    .map_err(|error| {
        format!(
            "Failed to start ETS2 through TruckersMP: {}",
            error
        )
    })?;

    let pid = stream_truckersmp_output(
        process,
        app,
        target,
    );

    Ok(format!(
        "TruckersMP ETS2 started (PID {})",
        pid
    ))
}

/* ==================================================
   START ATS
================================================== */

#[tauri::command]
fn start_ats_truckersmp(
    app: tauri::AppHandle,
) -> Result<String, String> {
    let cli = find_truckersmp_cli().ok_or_else(|| {
        "TruckersMP CLI is not installed. Please install it first.".to_string()
    })?;

    let game_dir = find_truckersmp_game_dir("ATS").ok_or_else(|| {
        "TruckersMP ATS game directory was not found. Please update/install ATS for TruckersMP first.".to_string()
    })?;

    let proton = find_proton_path().ok_or_else(|| {
        "TruckersMP Proton was not found.".to_string()
    })?;

    let runtime = find_steam_runtime_path().ok_or_else(|| {
        "TruckersMP Steam Runtime was not found.".to_string()
    })?;

    let target = "atsmp".to_string();

    let _ = app.emit(
        "truckersmp-log",
        "[MANAGER] Starting TruckersMP CLI for ATS...".to_string(),
    );

    let process = build_truckersmp_command(
        &cli,
        &game_dir,
        &proton,
        &runtime,
        &target,
    )
    .spawn()
    .map_err(|error| {
        format!(
            "Failed to start ATS through TruckersMP: {}",
            error
        )
    })?;

    let pid = stream_truckersmp_output(
        process,
        app,
        target,
    );

    Ok(format!(
        "TruckersMP ATS started (PID {})",
        pid
    ))
}

/* ==================================================
   OPEN GAME DIRECTORY
================================================== */

#[tauri::command]
fn open_game_directory(
    path: String,
) -> Result<String, String>
{
    let directory =
        PathBuf::from(&path);

    if !directory.exists() {
        return Err(format!(
            "Game directory does not exist: {}",
            path
        ));
    }

    if !directory.is_dir() {
        return Err(format!(
            "Game path is not a directory: {}",
            path
        ));
    }

    Command::new("xdg-open")
        .arg(&directory)
        .spawn()
        .map_err(|error| {
            format!(
                "Failed to open game directory: {}",
                error
            )
        })?;

    Ok(format!(
        "Opened game directory: {}",
        path
    ))
}

/* ==================================================
   PROCESS STATUS
================================================== */

#[tauri::command]
fn get_process_status()
    -> ProcessStatus
{
    let truckersmp =
        Command::new("pgrep")
            .args([
                "-f",
                "truckersmp-cli",
            ])
            .output()
            .map(|output| {
                output.status.success()
            })
            .unwrap_or(false);

    let truckersmp_process =
        Command::new("pgrep")
            .args([
                "-f",
                "TruckersMP",
            ])
            .output()
            .map(|output| {
                output.status.success()
            })
            .unwrap_or(false);

    let ets2 =
        Command::new("pgrep")
            .args([
                "-f",
                "eurotrucks2.exe",
            ])
            .output()
            .map(|output| {
                output.status.success()
            })
            .unwrap_or(false);

    let ats =
        Command::new("pgrep")
            .args([
                "-f",
                "amtrucks.exe",
            ])
            .output()
            .map(|output| {
                output.status.success()
            })
            .unwrap_or(false);

    ProcessStatus {
        truckersmp_running:
            truckersmp
                || truckersmp_process
                || ets2
                || ats,

        ets2_running: ets2,

        ats_running: ats,
    }
}

/* ==================================================
   TAURI
================================================== */

#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_opener::init(),
        )
        .invoke_handler(
            tauri::generate_handler![
                get_system_info,
                get_steam_info,
                get_truckersmp_info,
                install_truckersmp_cli,
                start_truckersmp,
                start_ats_truckersmp,
                open_game_directory,
                get_process_status
            ],
        )
        .run(
            tauri::generate_context!(),
        )
        .expect(
            "error while running application",
        );
}
