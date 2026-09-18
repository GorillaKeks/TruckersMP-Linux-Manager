use std::process::Command;

#[derive(serde::Serialize)]
struct SystemInfo {
    os: String,
    kernel: String,
    cpu: String,
    memory: String,
    gpu: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let os = read_command("lsb_release", &["-ds"])
        .unwrap_or_else(|| "Linux".to_string())
        .trim_matches('"')
        .to_string();

    let kernel = read_command("uname", &["-r"])
        .unwrap_or_else(|| "Unknown".to_string());

    let cpu = read_command("lscpu", &["-p=model"])
        .unwrap_or_else(|| "Unknown".to_string())
        .lines()
        .filter(|line| !line.starts_with('#'))
        .next()
        .unwrap_or("Unknown")
        .to_string();

    let memory = read_command("free", &["-h"])
        .and_then(|output| {
            output
                .lines()
                .find(|line| line.starts_with("Mem:"))
                .map(|line| line.to_string())
        })
        .unwrap_or_else(|| "Unknown".to_string());

    let gpu = detect_gpu();

    SystemInfo {
        os,
        kernel,
        cpu,
        memory,
        gpu,
    }
}

fn detect_gpu() -> String {
    if let Some(output) = read_command("nvidia-smi", &["--query-gpu=name", "--format=csv,noheader"]) {
        let gpu = output.trim();

        if !gpu.is_empty() {
            return gpu.to_string();
        }
    }

    if let Some(output) = read_command("lspci", &[]) {
        for line in output.lines() {
            if line.contains("VGA compatible controller")
                || line.contains("3D controller")
                || line.contains("Display controller")
            {
                if let Some((_, gpu)) = line.split_once(": ") {
                    return gpu.trim().to_string();
                }
            }
        }
    }

    "Unknown".to_string()
}

fn read_command(command: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(command).args(args).output().ok()?;

    if !output.status.success() {
        return None;
    }

    String::from_utf8(output.stdout).ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_system_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}