use serde::Serialize;
use std::path::Path;
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
    ets2: GameInfo,
    ats: GameInfo,
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

fn existing_path(path: &str) -> Option<String> {
    if Path::new(path).exists() {
        Some(path.to_string())
    } else {
        None
    }
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

#[tauri::command]
fn get_steam_info() -> SteamInfo {
    let home = std::env::var("HOME").unwrap_or_default();

    let steam_candidates = [
        format!("{home}/.steam/debian-installation"),
        format!("{home}/.steam/steam"),
        format!("{home}/.local/share/Steam"),
    ];

    let steam_path = steam_candidates
        .iter()
        .find(|path| Path::new(path).exists())
        .cloned();

    let ets2_candidates = [
        format!("{home}/.steam/debian-installation/steamapps/common/Euro Truck Simulator 2"),
        format!("{home}/.steam/steam/steamapps/common/Euro Truck Simulator 2"),
        format!("{home}/.local/share/Steam/steamapps/common/Euro Truck Simulator 2"),
        "/mnt/games/SteamLibrary/steamapps/common/Euro Truck Simulator 2".to_string(),
    ];

    let ats_candidates = [
        format!("{home}/.steam/debian-installation/steamapps/common/American Truck Simulator"),
        format!("{home}/.steam/steam/steamapps/common/American Truck Simulator"),
        format!("{home}/.local/share/Steam/steamapps/common/American Truck Simulator"),
        "/mnt/games/SteamLibrary/steamapps/common/American Truck Simulator".to_string(),
    ];

    let ets2_path = ets2_candidates
        .iter()
        .find(|path| Path::new(path).exists())
        .cloned();

    let ats_path = ats_candidates
        .iter()
        .find(|path| Path::new(path).exists())
        .cloned();

    SteamInfo {
        installed: steam_path.is_some(),
        path: steam_path,
        ets2: GameInfo {
            name: "Euro Truck Simulator 2".to_string(),
            installed: ets2_path.is_some(),
            path: ets2_path,
        },
        ats: GameInfo {
            name: "American Truck Simulator".to_string(),
            installed: ats_path.is_some(),
            path: ats_path,
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_steam_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}