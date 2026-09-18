use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
struct SystemInfo {
    os: String,
    kernel: String,
    cpu: String,
    memory: String,
    gpu: String,
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
        &[
            "-c",
            "free -h | awk '/^Mem:/ {print $3 \" / \" $2}'",
        ],
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_system_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
