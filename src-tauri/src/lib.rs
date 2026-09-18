use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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
    ets2_path: Option<String>,
    proton_installed: bool,
    proton_path: Option<String>,
    steam_runtime_installed: bool,
    steam_runtime_path: Option<String>,
}

fn command_output(command: &str, args: &[&str]) -> String {
    Command::new(command)
        .args(args)
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "Unknown".to_string())
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let os = command_output("lsb_release", &["-ds"]);
    let kernel = command_output("uname", &["-r"]);

    let cpu = command_output(
        "bash",
        &["-c", "lscpu | grep 'Model name' | cut -d: -f2- | xargs"],
    );

    let memory = command_output(
        "bash",
        &["-c", "free -h | awk '/^Mem:/ {print $3 \" / \" $2}'"],
    );

    let gpu = {
        let nvidia = command_output(
            "nvidia-smi",
            &["--query-gpu=name", "--format=csv,noheader"],
        );

        if nvidia != "Unknown" {
            nvidia
        } else {
            command_output(
                "bash",
                &["-c", "lspci | grep -Ei 'vga|3d|display' | head -1"],
            )
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

fn parse_steam_library_paths(vdf_path: &Path) -> Vec<PathBuf> {
    let mut libraries = Vec::new();

    let content = match fs::read_to_string(vdf_path) {
        Ok(content) => content,
        Err(_) => return libraries,
    };

    for line in content.lines() {
        let line = line.trim();

        if line.starts_with("\"path\"") {
            let parts: Vec<&str> = line.split('"').collect();

            if parts.len() >= 4 {
                let path = parts[3].replace("\\\\", "\\");

                if Path::new(&path).exists() {
                    libraries.push(PathBuf::from(path));
                }
            }
        }
    }

    libraries
}

fn find_steam_libraries(home: &str) -> Vec<PathBuf> {
    let mut libraries = Vec::new();

    let steam_roots = [
        PathBuf::from(format!("{home}/.steam/debian-installation")),
        PathBuf::from(format!("{home}/.steam/steam")),
        PathBuf::from(format!("{home}/.local/share/Steam")),
    ];

    for steam_root in steam_roots {
        if !steam_root.exists() {
            continue;
        }

        let main_library = steam_root.join("steamapps");

        if main_library.exists() {
            libraries.push(main_library);
        }

        let library_vdf = steam_root.join("steamapps/libraryfolders.vdf");

        for library in parse_steam_library_paths(&library_vdf) {
            let steamapps = library.join("steamapps");

            if steamapps.exists() {
                libraries.push(steamapps);
            }
        }
    }

    libraries.sort();
    libraries.dedup();

    libraries
}

fn find_game(libraries: &[PathBuf], game_name: &str) -> GameInfo {
    for library in libraries {
        let game_path = library.join("common").join(game_name);

        if game_path.exists() {
            return GameInfo {
                name: game_name.to_string(),
                installed: true,
                path: Some(game_path.to_string_lossy().to_string()),
            };
        }
    }

    GameInfo {
        name: game_name.to_string(),
        installed: false,
        path: None,
    }
}

#[tauri::command]
fn get_steam_info() -> SteamInfo {
    let home = std::env::var("HOME").unwrap_or_default();

    let steam_paths = [
        format!("{home}/.steam/debian-installation"),
        format!("{home}/.steam/steam"),
        format!("{home}/.local/share/Steam"),
    ];

    let steam_path = steam_paths
        .iter()
        .find(|path| Path::new(path).exists())
        .cloned();

    let libraries = find_steam_libraries(&home);

    let library_strings = libraries
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect();

    SteamInfo {
        installed: steam_path.is_some(),
        path: steam_path,
        libraries: library_strings,
        ets2: find_game(&libraries, "Euro Truck Simulator 2"),
        ats: find_game(&libraries, "American Truck Simulator"),
    }
}

fn first_existing_path(candidates: &[PathBuf]) -> Option<PathBuf> {
    candidates
        .iter()
        .find(|path| path.exists())
        .cloned()
}

#[tauri::command]
fn get_truckersmp_info() -> TruckersMpInfo {
    let home = std::env::var("HOME").unwrap_or_default();

    let candidates = [
        PathBuf::from(format!("{home}/truckersmp-cli")),
        PathBuf::from(format!("{home}/.local/share/truckersmp")),
        PathBuf::from(format!("{home}/TruckersMP")),
        PathBuf::from("/mnt/games/TruckersMP"),
    ];

    let truckersmp_path = first_existing_path(&candidates);

    let base_paths = [
        PathBuf::from("/mnt/games/TruckersMP/ETS2"),
        PathBuf::from(format!("{home}/TruckersMP/ETS2")),
        PathBuf::from(format!("{home}/.local/share/truckersmp/ETS2")),
    ];

    let ets2_path = first_existing_path(&base_paths);

    let proton_paths = [
        PathBuf::from("/mnt/games/TruckersMP/Proton"),
        PathBuf::from(format!("{home}/TruckersMP/Proton")),
        PathBuf::from(format!("{home}/.local/share/truckersmp/Proton")),
    ];

    let proton_path = first_existing_path(&proton_paths);

    let runtime_paths = [
        PathBuf::from("/mnt/games/TruckersMP/SteamRuntime"),
        PathBuf::from(format!("{home}/TruckersMP/SteamRuntime")),
        PathBuf::from(format!("{home}/.local/share/truckersmp/SteamRuntime")),
    ];

    let runtime_path = first_existing_path(&runtime_paths);

    TruckersMpInfo {
        installed: truckersmp_path.is_some(),
        path: truckersmp_path.map(|p| p.to_string_lossy().to_string()),
        ets2_path: ets2_path.map(|p| p.to_string_lossy().to_string()),
        proton_installed: proton_path.is_some(),
        proton_path: proton_path.map(|p| p.to_string_lossy().to_string()),
        steam_runtime_installed: runtime_path.is_some(),
        steam_runtime_path: runtime_path.map(|p| p.to_string_lossy().to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_steam_info,
            get_truckersmp_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}