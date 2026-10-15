use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{ShellExt, process::CommandEvent};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_sql::{Migration, MigrationKind};
use axum::{
    routing::{post, get},
    Router,
    extract::{State, Json, Query},
    http::StatusCode,
};
use tower_http::cors::{CorsLayer, Any};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use tauri::Manager;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;

#[derive(Deserialize, Default, Debug)]
struct AppSettings {
    #[serde(rename = "downloadPath")]
    download_path: Option<String>,
    #[serde(rename = "browserAuth")]
    browser_auth: Option<String>,
    #[serde(rename = "optimizeForMobile")]
    optimize_for_mobile: Option<bool>,
}

fn write_cookies_txt(app: &AppHandle, cookies: Vec<serde_json::Value>) -> Option<std::path::PathBuf> {
    let app_data_dir = app.path().app_data_dir().ok()?;
    let cookies_path = app_data_dir.join("temp_cookies.txt");
    
    let mut content = String::from("# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n# This is a generated file!  Do not edit.\n\n");
    
    for cookie in cookies {
        let domain = cookie.get("domain").and_then(|v| v.as_str()).unwrap_or("");
        let include_subdomains = if domain.starts_with('.') { "TRUE" } else { "FALSE" };
        let path = cookie.get("path").and_then(|v| v.as_str()).unwrap_or("/");
        let secure = cookie.get("secure").and_then(|v| v.as_bool()).unwrap_or(false);
        let secure_str = if secure { "TRUE" } else { "FALSE" };
        
        let expires = cookie.get("expirationDate").and_then(|v| v.as_f64()).map(|v| v as i64).unwrap_or(0);
        
        let name = cookie.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let value = cookie.get("value").and_then(|v| v.as_str()).unwrap_or("");
        
        if !domain.is_empty() && !name.is_empty() {
            let line = format!("{}\t{}\t{}\t{}\t{}\t{}\t{}\n", domain, include_subdomains, path, secure_str, expires, name, value);
            content.push_str(&line);
        }
    }
    
    std::fs::write(&cookies_path, content).ok()?;
    Some(cookies_path)
}

fn read_settings(app: &AppHandle) -> AppSettings {
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let settings_path = app_data_dir.join("settings.json");
        if let Ok(content) = std::fs::read_to_string(settings_path) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

#[derive(Deserialize)]
struct DownloadRequest {
    url: String,
    format: Option<String>,
    extension_cookies: Option<Vec<serde_json::Value>>,
}

#[derive(Deserialize)]
struct ProgressQuery {
    url: String,
}

#[derive(Deserialize)]
struct FormatsRequest {
    url: String,
    extension_cookies: Option<Vec<serde_json::Value>>,
}

#[derive(Serialize)]
struct FormatsResponse {
    qualities: Vec<u32>,
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    url: String,
    progress: String,
    format: Option<String>,
    status: Option<String>,
}

type AppState = Arc<AppStateInner>;

struct AppStateInner {
    app_handle: AppHandle,
    progress_map: Mutex<HashMap<String, String>>,
    process_map: Mutex<HashMap<String, tauri_plugin_shell::process::CommandChild>>,
    db_pool: sqlx::SqlitePool,
}

// ----------------------
// Tauri Commands
// ----------------------

#[tauri::command]
fn open_folder(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let path_buf = std::path::PathBuf::from(&path);
    let parent = if path_buf.is_dir() {
        path_buf
    } else {
        path_buf.parent().unwrap_or(std::path::Path::new("")).to_path_buf()
    };
    
    app.opener().open_path(parent.to_string_lossy().to_string(), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    app.opener().open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_ffmpeg(app: tauri::AppHandle) -> Result<bool, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let ffmpeg_exe = if cfg!(target_os = "windows") {
        app_data_dir.join("ffmpeg.exe")
    } else {
        app_data_dir.join("ffmpeg")
    };
    
    if ffmpeg_exe.exists() {
        return Ok(true);
    }
    
    // Check if it's available globally on the system PATH
    let output = std::process::Command::new("ffmpeg")
        .arg("-version")
        .output();
        
    Ok(output.is_ok() && output.unwrap().status.success())
}

#[tauri::command]
async fn install_ffmpeg(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    }
    
    let (url, ext) = if cfg!(target_os = "windows") {
        ("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip", "zip")
    } else if cfg!(target_os = "macos") {
        ("https://evermeet.cx/ffmpeg/ffmpeg-6.0.zip", "zip")
    } else {
        ("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz", "tar.xz")
    };

    let archive_path = app_data_dir.join(format!("ffmpeg_archive.{}", ext));

    let response = reqwest::get(url).await.map_err(|e| format!("Download failed: {}", e))?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&archive_path, bytes).map_err(|e| e.to_string())?;

    let output = std::process::Command::new("tar")
        .arg("-xf")
        .arg(&archive_path)
        .current_dir(&app_data_dir)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!("Extraction failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let mut ffmpeg_exe_path = None;
    for entry in walkdir::WalkDir::new(&app_data_dir).into_iter().filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name == "ffmpeg.exe" || name == "ffmpeg" {
            ffmpeg_exe_path = Some(entry.path().to_path_buf());
            break;
        }
    }

    if let Some(src) = ffmpeg_exe_path {
        let dest = if cfg!(target_os = "windows") {
            app_data_dir.join("ffmpeg.exe")
        } else {
            app_data_dir.join("ffmpeg")
        };
        if src != dest {
            std::fs::rename(&src, &dest).map_err(|e| e.to_string())?;
        }
        
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&dest).map_err(|e| e.to_string())?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&dest, perms).map_err(|e| e.to_string())?;
        }
    } else {
        return Err("Could not find ffmpeg binary in extracted archive".to_string());
    }

    let _ = std::fs::remove_file(archive_path);
    Ok(())
}

#[tauri::command]
fn export_extension_zip(app: tauri::AppHandle) -> Result<String, String> {
    let zip_bytes = include_bytes!("../../builds/re-play-extension.zip");
    
    let download_dir = app.path().download_dir().map_err(|e| e.to_string())?;
    
    let ext_folder = download_dir.join("Re-play Extension");
    if !ext_folder.exists() {
        std::fs::create_dir_all(&ext_folder).map_err(|e| e.to_string())?;
    }
    
    let temp_zip_path = download_dir.join("temp-re-play-ext.zip");
    std::fs::write(&temp_zip_path, zip_bytes).map_err(|e| format!("Failed to write zip: {}", e))?;
    
    let output = std::process::Command::new("tar")
        .arg("-xf")
        .arg(&temp_zip_path)
        .current_dir(&ext_folder)
        .output()
        .map_err(|e| e.to_string())?;
        
    let _ = std::fs::remove_file(temp_zip_path);
    
    if !output.status.success() {
        return Err(format!("Extraction failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    Ok(ext_folder.to_string_lossy().into_owned())
}

// ----------------------
// Core Logic
// ----------------------

async fn perform_download(state: AppState, url: String, format: Option<String>, extension_cookies: Option<Vec<serde_json::Value>>) {
    let app = &state.app_handle;
    let settings = read_settings(app);

    let sidecar_command = app.shell().sidecar("yt-dlp")
        .expect("failed to create `yt-dlp` binary command");
        
    let download_dir = settings.download_path
        .filter(|p| !p.is_empty())
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| dirs::download_dir().unwrap_or_else(|| std::path::PathBuf::from(".")));
        
    let output_template = download_dir.join("%(title)s.%(ext)s");

    let mut args = vec![
        "--newline".to_string(),
        "--no-colors".to_string(),
        "--progress".to_string(),
        "--progress-template".to_string(), "download:#JSONPROGRESS#:%(progress)j\n".to_string(),
        "--progress-template".to_string(), "frag_download:#JSONPROGRESS#:%(progress)j\n".to_string(),
        "--progress-template".to_string(), "postprocess:#JSONPROGRESS#:%(progress)j\n".to_string(),
        "--print".to_string(), "after_move:filepath:%(filepath)s".to_string(),
        "-o".to_string(), output_template.to_str().unwrap().to_string(),
    ];

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    let manifest_bin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");

    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    
    let target = match (os, arch) {
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("windows", "aarch64") => "aarch64-pc-windows-msvc",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu",
        _ => "x86_64-pc-windows-msvc",
    };
    
    let ext = if os == "windows" { ".exe" } else { "" };
    let quickjs_name = format!("quickjs-{}{}", target, ext);

    let quickjs_path = if exe_dir.join(&quickjs_name).exists() {
        exe_dir.join(&quickjs_name)
    } else {
        manifest_bin.join(&quickjs_name)
    };

    let ffmpeg_path = if cfg!(target_os = "windows") {
        app.path().app_data_dir().unwrap_or_default().join("ffmpeg.exe")
    } else {
        app.path().app_data_dir().unwrap_or_default().join("ffmpeg")
    };

    if quickjs_path.exists() && quickjs_path.metadata().map(|m| m.len()).unwrap_or(0) > 100 {
        args.push("--js-runtimes".to_string());
        args.push(format!("quickjs:{}", quickjs_path.to_str().unwrap()));
    } else {
        args.push("--js-runtimes".to_string());
        args.push("node:node".to_string());
    }

    if ffmpeg_path.exists() {
        args.push("--ffmpeg-location".to_string());
        args.push(ffmpeg_path.to_str().unwrap().to_string());
    }

    let saved_cookies = app.path().app_data_dir().unwrap_or_default().join("saved_cookies.txt");

    if let Some(cookies) = extension_cookies {
        if let Some(cookie_path) = write_cookies_txt(app, cookies) {
            args.push("--cookies".to_string());
            args.push(cookie_path.to_string_lossy().to_string());
        }
    } else if saved_cookies.exists() {
        args.push("--cookies".to_string());
        args.push(saved_cookies.to_string_lossy().to_string());
    } else if let Some(browser) = settings.browser_auth {
        if !browser.is_empty() && browser != "none" {
            args.push("--cookies-from-browser".to_string());
            args.push(browser);
        }
    }

    args.push("--no-playlist".to_string());

    if let Some(f) = format {
        if f == "audio_only" {
            args.push("-x".to_string());
            args.push("--audio-format".to_string());
            args.push("mp3".to_string());
        } else if f == "best" {
            args.push("-f".to_string());
            args.push("bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best".to_string());
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
        } else if f.ends_with('p') {
            let height = f.trim_end_matches('p');
            args.push("-f".to_string());
            // Strongly prioritize native mp4/m4a for standard video player compatibility
            args.push(format!(
                "bestvideo[height<={}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={}]+bestaudio/best",
                height, height
            ));
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
        } else {
            args.push("-f".to_string());
            args.push("bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best".to_string());
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
        }
    }

    if settings.optimize_for_mobile.unwrap_or(false) {
        args.push("--postprocessor-args".to_string());
        args.push("ffmpeg:-c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k -pix_fmt yuv420p -movflags +faststart".to_string());
    }

    args.push(url.clone());

    // Log the exact command being run for debugging
    println!("[Re-play] yt-dlp args: {:?}", args);

    let (mut rx, child) = sidecar_command
        .env("PYTHONUNBUFFERED", "1")
        .args(args)
        .spawn()
        .expect("Failed to spawn yt-dlp");

    {
        let mut pmap = state.process_map.lock().await;
        pmap.insert(url.clone(), child);
    }

    let state_clone = state.clone();
    
    tauri::async_runtime::spawn(async move {
        let mut final_path = String::new();
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let chunk = String::from_utf8_lossy(&line);
                    for line_str in chunk.lines() {
                        let line_str = line_str.trim();
                        println!("[Re-play stdout] {}", line_str);
                        if let Some(idx) = line_str.find("#JSONPROGRESS#:") {
                            let json_str = line_str[idx + "#JSONPROGRESS#:".len()..].trim();
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                                let is_postprocessor = json.get("postprocessor").is_some();
                                
                                if is_postprocessor {
                                    let status = json.get("status").and_then(|v| v.as_str()).unwrap_or("");
                                    let pp_name = json.get("postprocessor").and_then(|v| v.as_str()).unwrap_or("");
                                    println!("[Re-play] Postprocessor detected on stdout: name={}, status={}", pp_name, status);
                                    
                                    if status == "started" && !pp_name.is_empty() {
                                        let display = "Processing with FFMPEG... · This may take a few minutes".to_string();
                                        println!("[Re-play] Emitting FFMPEG processing state for postprocessor: {}", pp_name);
                                        let payload = ProgressPayload { url: url.clone(), progress: display.clone(), format: None, status: None };
                                        let _ = state_clone.app_handle.emit("download-progress", payload);
                                        let mut map = state_clone.progress_map.lock().await;
                                        map.insert(url.clone(), display);
                                    }
                                } else {
                                    let mut percent = String::new();
                                    let mut speed = String::new();
                                    let mut eta = String::new();
                                    
                                    if let Some(p) = json.get("_percent_str").and_then(|v| v.as_str()) {
                                        percent = p.trim().to_string();
                                    }
                                    if let Some(s) = json.get("_speed_str").and_then(|v| v.as_str()) {
                                        speed = s.trim().to_string();
                                    }
                                    if let Some(e) = json.get("_eta_str").and_then(|v| v.as_str()) {
                                        eta = format!("ETA {}", e.trim());
                                    }
                                    
                                    if percent == "NA" || percent == "N/A" || percent.is_empty() {
                                        percent = "NA".to_string();
                                    }
                                    
                                    let display = if !speed.is_empty() && !eta.is_empty() && !speed.contains("NA") && !eta.contains("NA") {
                                        format!("{} · {} · {}", percent, speed, eta)
                                    } else {
                                        percent.clone()
                                    };
                                    
                                    // Don't let a download "100%" overwrite the FFMPEG processing state
                                    let should_skip = {
                                        let map = state_clone.progress_map.lock().await;
                                        map.get(&url).map(|s| s.contains("FFMPEG")).unwrap_or(false)
                                    };
                                    if !should_skip {
                                        let payload = ProgressPayload { url: url.clone(), progress: display.clone(), format: None, status: None };
                                        let _ = state_clone.app_handle.emit("download-progress", payload);
                                        
                                        let mut map = state_clone.progress_map.lock().await;
                                        map.insert(url.clone(), display);
                                    }
                                }
                            }
                        } else if line_str.starts_with("filepath:") {
                            final_path = line_str.trim_start_matches("filepath:").trim().to_string();
                        } else if line_str.starts_with("[download] ") && line_str.contains("has already been downloaded") {
                            if let Some(end) = line_str.find(" has already been downloaded") {
                                final_path = line_str[11..end].trim().to_string();
                            }
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    let chunk = String::from_utf8_lossy(&line);
                    for line_str in chunk.lines() {
                        let line_str = line_str.trim();
                        eprintln!("[Re-play stderr] {}", line_str);

                        if let Some(idx) = line_str.find("#JSONPROGRESS#:") {
                            let json_str = line_str[idx + "#JSONPROGRESS#:".len()..].trim();
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                                if json.get("postprocessor").is_some() {
                                    let status = json.get("status").and_then(|v| v.as_str()).unwrap_or("");
                                    let pp_name = json.get("postprocessor").and_then(|v| v.as_str()).unwrap_or("");
                                    println!("[Re-play] Postprocessor detected on stderr: name={}, status={}", pp_name, status);

                                    if status == "started" && !pp_name.is_empty() {
                                        let display = "Processing with FFMPEG... · This may take a few minutes".to_string();
                                        println!("[Re-play] Emitting FFMPEG processing state from stderr for: {}", pp_name);
                                        let payload = ProgressPayload { url: url.clone(), progress: display.clone(), format: None, status: None };
                                        let _ = state_clone.app_handle.emit("download-progress", payload);
                                        let mut map = state_clone.progress_map.lock().await;
                                        map.insert(url.clone(), display);
                                    }
                                }
                            }
                        } else if line_str.starts_with("[Merger]") || line_str.starts_with("[VideoConvertor]") || line_str.starts_with("[Fixup") || line_str.starts_with("[ExtractAudio]") || line_str.starts_with("[FFmpegFixup") {
                            let display = "Processing with FFMPEG... · This may take a few minutes".to_string();
                            let payload = ProgressPayload { url: url.clone(), progress: display.clone(), format: None, status: None };
                            let _ = state_clone.app_handle.emit("download-progress", payload);
                            let mut map = state_clone.progress_map.lock().await;
                            map.insert(url.clone(), display);
                        } else if line_str.to_lowercase().contains("error:") && !line_str.contains("#JSONPROGRESS#") {
                            let mut map = state_clone.progress_map.lock().await;
                            map.insert(url.clone(), format!("Error: {}", line_str));
                        }
                    }
                }
                CommandEvent::Terminated(status) => {
                    println!("[Re-play] yt-dlp exited with: {:?}", status);
                    
                    let exit_code = status.code.unwrap_or(-1);
                    let has_error = {
                        let map = state_clone.progress_map.lock().await;
                        map.get(&url).map(|s| s.starts_with("Error:")).unwrap_or(false)
                    };
                    let succeeded = !final_path.is_empty() && exit_code == 0 && !has_error;
                    
                    let file_name = std::path::Path::new(&final_path)
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| url.clone());
                    
                    if succeeded {
                        let _ = sqlx::query("UPDATE history SET status = 'Completed', file_path = ?, title = ? WHERE url = ? AND status = 'Downloading'")
                            .bind(&final_path)
                            .bind(&file_name)
                            .bind(&url)
                            .execute(&state_clone.db_pool).await;
                    } else {
                        // Get the error message from progress map if available
                        let error_msg = {
                            let map = state_clone.progress_map.lock().await;
                            map.get(&url).cloned().unwrap_or_default()
                        };
                        let fail_reason = if error_msg.starts_with("Error:") {
                            error_msg.clone()
                        } else {
                            format!("Failed (exit code {})", exit_code)
                        };
                        let _ = sqlx::query("UPDATE history SET status = 'Failed', title = ? WHERE url = ? AND status = 'Downloading'")
                            .bind(&fail_reason)
                            .bind(&url)
                            .execute(&state_clone.db_pool).await;
                    }

                    #[derive(Serialize, Clone)]
                    struct FinishedPayload {
                        url: String,
                        file_path: String,
                    }
                    let payload = FinishedPayload { url: url.clone(), file_path: final_path.clone() };
                    let _ = state_clone.app_handle.emit("download-finished-data", payload);
                    let _ = state_clone.app_handle.emit("download-finished", url.clone());
                    let mut map = state_clone.progress_map.lock().await;
                    if succeeded {
                        map.insert(url.clone(), "100% (Completed)".to_string());
                    } else {
                        let current = map.get(&url).cloned().unwrap_or_default();
                        if !current.starts_with("Error:") {
                            map.insert(url.clone(), format!("Error: Download failed (exit code {})", exit_code));
                        }
                    }
                    let mut map = state_clone.process_map.lock().await;
                    map.remove(&url);
                    break;
                }
                _ => {}
            }
        }
    });
}

#[derive(Deserialize)]
struct PauseRequest {
    url: String,
}

async fn pause_download(
    State(state): State<AppState>,
    Json(payload): Json<PauseRequest>,
) -> StatusCode {
    {
        let mut map = state.process_map.lock().await;
        if let Some(child) = map.remove(&payload.url) {
            let _ = child.kill();
            println!("[Re-play] Paused download for {}", payload.url);
        }
    }
    
    {
        let mut pmap = state.progress_map.lock().await;
        pmap.insert(payload.url.clone(), "Paused".to_string());
    }
    
    let _ = sqlx::query("UPDATE history SET status = 'Paused' WHERE url = ? AND status = 'Downloading'")
        .bind(&payload.url)
        .execute(&state.db_pool).await;
        
    StatusCode::OK
}

async fn handle_download(
    State(state): State<AppState>,
    Json(payload): Json<DownloadRequest>,
) -> StatusCode {
    println!("[Re-play] Received download request for: {}", payload.url);
    let url = payload.url;
    let format = payload.format.clone().unwrap_or_else(|| "best".to_string());
    let extension_cookies = payload.extension_cookies;
    
    #[derive(Serialize, Clone)]
    struct StartedPayload {
        url: String,
        format: String,
    }
    let _ = state.app_handle.emit("download-started-data", StartedPayload { url: url.clone(), format: format.clone() });
    let _ = state.app_handle.emit("download-started", url.clone());
    
    let pool = state.db_pool.clone();
    let url_clone = url.clone();
    let format_clone = format.clone();
    tauri::async_runtime::spawn(async move {
        let _ = sqlx::query("INSERT INTO history (url, title, format, file_path, status) VALUES (?, ?, ?, ?, ?)")
            .bind(url_clone)
            .bind("Downloading...")
            .bind(format_clone)
            .bind("")
            .bind("Downloading")
            .execute(&pool).await;
    });

    {
        let mut map = state.progress_map.lock().await;
        map.insert(url.clone(), "0%".to_string());
    }

    tauri::async_runtime::spawn(async move {
        perform_download(state, url, payload.format, extension_cookies).await;
    });
    
    StatusCode::ACCEPTED
}

async fn get_progress(
    State(state): State<AppState>,
    Query(query): Query<ProgressQuery>,
) -> Json<ProgressPayload> {
    let map = state.progress_map.lock().await;
    let progress = map.get(&query.url).cloned().unwrap_or_else(|| "Not found".to_string());
    
    let row = sqlx::query("SELECT format, status FROM history WHERE url = ? ORDER BY id DESC LIMIT 1")
        .bind(&query.url)
        .fetch_optional(&state.db_pool).await.unwrap_or(None);
        
    let format = row.as_ref().and_then(|r| sqlx::Row::try_get::<String, _>(r, "format").ok());
    let status = row.as_ref().and_then(|r| sqlx::Row::try_get::<String, _>(r, "status").ok());

    Json(ProgressPayload {
        url: query.url,
        progress,
        format,
        status,
    })
}

async fn get_all_progress(
    State(state): State<AppState>,
) -> Json<HashMap<String, String>> {
    let map = state.progress_map.lock().await;
    Json(map.clone())
}

#[derive(Deserialize)]
struct ClearProgressRequest {
    url: String,
}

async fn clear_progress(
    State(state): State<AppState>,
    Json(payload): Json<ClearProgressRequest>,
) -> StatusCode {
    let mut map = state.progress_map.lock().await;
    map.remove(&payload.url);
    StatusCode::OK
}

#[derive(Deserialize)]
struct SyncCookiesRequest {
    browser: String,
}

async fn sync_cookies(
    State(state): State<AppState>,
    Json(payload): Json<SyncCookiesRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let app = &state.app_handle;
    let app_data_dir = app.path().app_data_dir().unwrap();
    let cookies_path = app_data_dir.join("saved_cookies.txt");

    let sidecar_command = app.shell().sidecar("yt-dlp")
        .expect("failed to create `yt-dlp` binary command");
        
    let args = vec![
        "--cookies-from-browser".to_string(),
        payload.browser,
        "--cookies".to_string(),
        cookies_path.to_string_lossy().to_string(),
        "--dump-json".to_string(),
        "--no-playlist".to_string(),
        "https://www.youtube.com/watch?v=jNQXAC9IVRw".to_string(),
    ];

    let output = sidecar_command
        .args(args)
        .output()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if output.status.success() {
        Ok(StatusCode::OK)
    } else {
        Err((StatusCode::BAD_REQUEST, String::from_utf8_lossy(&output.stderr).to_string()))
    }
}

async fn clear_synced_cookies(
    State(state): State<AppState>,
) -> StatusCode {
    let app = &state.app_handle;
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let cookies_path = app_data_dir.join("saved_cookies.txt");
        let _ = std::fs::remove_file(cookies_path);
    }
    StatusCode::OK
}

async fn get_formats(
    State(state): State<AppState>,
    Json(payload): Json<FormatsRequest>,
) -> Json<FormatsResponse> {
    let app = &state.app_handle;
    let settings = read_settings(app);
    let saved_cookies = app.path().app_data_dir().unwrap_or_default().join("saved_cookies.txt");
    let sidecar_command = app.shell().sidecar("yt-dlp")
        .expect("failed to create `yt-dlp` binary command");
        
    let mut args = vec![
        "--dump-json".to_string(),
        "--no-warnings".to_string(),
        "--no-playlist".to_string(),
    ];

    if let Some(cookies) = payload.extension_cookies {
        if let Some(cookie_path) = write_cookies_txt(app, cookies) {
            args.push("--cookies".to_string());
            args.push(cookie_path.to_string_lossy().to_string());
        }
    } else if saved_cookies.exists() {
        args.push("--cookies".to_string());
        args.push(saved_cookies.to_string_lossy().to_string());
    } else if let Some(browser) = settings.browser_auth {
        if !browser.is_empty() && browser != "none" {
            args.push("--cookies-from-browser".to_string());
            args.push(browser);
        }
    }

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();
    let manifest_bin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");

    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let target = match (os, arch) {
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("windows", "aarch64") => "aarch64-pc-windows-msvc",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu",
        _ => "x86_64-pc-windows-msvc",
    };
    let ext = if os == "windows" { ".exe" } else { "" };
    let quickjs_name = format!("quickjs-{}{}", target, ext);

    let quickjs_path = if exe_dir.join(&quickjs_name).exists() {
        exe_dir.join(&quickjs_name)
    } else {
        manifest_bin.join(&quickjs_name)
    };

    if quickjs_path.exists() && quickjs_path.metadata().map(|m| m.len()).unwrap_or(0) > 100 {
        args.push("--js-runtimes".to_string());
        args.push(format!("quickjs:{}", quickjs_path.to_str().unwrap()));
    } else {
        args.push("--js-runtimes".to_string());
        args.push("node:node".to_string());
    }

    println!("[Re-play] Fetching formats for url: {}", payload.url);
    args.push(payload.url);

    let (mut rx, _) = sidecar_command
        .env("PYTHONUNBUFFERED", "1")
        .args(args)
        .spawn()
        .expect("Failed to spawn yt-dlp");
        
    let mut json_str = String::new();
    let mut stderr_str = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                json_str.push_str(&String::from_utf8_lossy(&line));
            }
            CommandEvent::Stderr(line) => {
                stderr_str.push_str(&String::from_utf8_lossy(&line));
            }
            _ => {}
        }
    }

    if !stderr_str.is_empty() {
        println!("[Re-play] get_formats stderr: {}", stderr_str.trim());
    }

    let parsed_json = serde_json::from_str::<serde_json::Value>(&json_str)
        .ok()
        .or_else(|| {
            json_str.lines().find_map(|line| {
                let trimmed = line.trim();
                if trimmed.starts_with('{') && trimmed.ends_with('}') {
                    serde_json::from_str::<serde_json::Value>(trimmed).ok()
                } else {
                    None
                }
            })
        });

    if let Some(json) = parsed_json {
        if let Some(formats) = json.get("formats").and_then(|f| f.as_array()) {
            let mut heights: Vec<u32> = formats.iter().filter_map(|f| {
                let vcodec = f.get("vcodec").and_then(|v| v.as_str());
                if vcodec == Some("none") {
                    return None;
                }
                if let Some(height) = f.get("height").and_then(|h| h.as_u64()) {
                    if height > 0 {
                        return Some(height as u32);
                    }
                }
                if let Some(height) = f.get("height").and_then(|h| h.as_f64()) {
                    if height > 0.0 {
                        return Some(height as u32);
                    }
                }
                if let Some(res) = f.get("resolution").and_then(|r| r.as_str()) {
                    if let Some((_, h_str)) = res.split_once('x') {
                        if let Ok(h) = h_str.parse::<u32>() {
                            if h > 0 {
                                return Some(h);
                            }
                        }
                    }
                }
                None
            }).collect();
            
            heights.sort_unstable_by(|a, b| b.cmp(a));
            heights.dedup();
            
            println!("[Re-play] Found qualities: {:?}", heights);
            return Json(FormatsResponse { qualities: heights });
        }
    }
    
    println!("[Re-play] No video qualities extracted from yt-dlp response.");
    Json(FormatsResponse { qualities: vec![] })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_history_table",
            sql: "CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT,
                title TEXT,
                format TEXT,
                file_path TEXT,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:history.db", migrations).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_folder, open_file, check_ffmpeg, install_ffmpeg, export_extension_zip])
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // Ensure app_data_dir exists so tauri-plugin-store can save settings.json
            let app_data_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            if !app_data_dir.exists() {
                let _ = std::fs::create_dir_all(&app_data_dir);
            }

            let db_path = app_data_dir.join("history.db");
            let conn_str = format!("sqlite:{}", db_path.to_string_lossy());
            
            tauri::async_runtime::spawn(async move {
                let options = SqliteConnectOptions::from_str(&conn_str)
                    .unwrap()
                    .create_if_missing(true);
                let db_pool = SqlitePoolOptions::new().connect_with(options).await.unwrap();

                let app_state = Arc::new(AppStateInner {
                    app_handle: app_handle.clone(),
                    progress_map: Mutex::new(HashMap::new()),
                    process_map: Mutex::new(HashMap::new()),
                    db_pool: db_pool.clone(),
                });
                
                let _ = sqlx::query("UPDATE history SET status = 'Error (Interrupted)' WHERE status = 'Downloading'")
                    .execute(&db_pool).await;

                let cors = CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any);

                let router = Router::new()
                    .route("/download", post(handle_download))
                    .route("/pause", post(pause_download))
                    .route("/progress", get(get_progress))
                    .route("/formats", post(get_formats))
                    .route("/all_progress", get(get_all_progress))
                    .route("/clear_progress", post(clear_progress))
                    .route("/sync_cookies", post(sync_cookies))
                    .route("/clear_synced_cookies", post(clear_synced_cookies))
                    .layer(cors)
                    .with_state(app_state);

                let listener = tokio::net::TcpListener::bind("127.0.0.1:14222").await.unwrap();
                println!("Local server running on 127.0.0.1:14222");
                axum::serve(listener, router).await.unwrap();
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
