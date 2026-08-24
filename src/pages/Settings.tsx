import { useState, useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import { FolderOpen, Save, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { checkForUpdates } from "../components/UpdateChecker";

export function Settings() {
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [downloadPath, setDownloadPath] = useState("");
  const [defaultFormat, setDefaultFormat] = useState("best");
  const [theme, setTheme] = useState("dark");
  const [browserAuth, setBrowserAuth] = useState("none");
  const [optimizeForMobile, setOptimizeForMobile] = useState(false);
  const [saving, setSaving] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string, error: boolean } | null>(null);

  const [hasFfmpeg, setHasFfmpeg] = useState(() => localStorage.getItem("hasFfmpeg") === "true");
  const [installingFfmpeg, setInstallingFfmpeg] = useState(false);
  const [ffmpegMessage, setFfmpegMessage] = useState<{ text: string, error: boolean } | null>(null);

  useEffect(() => {
    loadSettings();
    checkFfmpeg();
  }, []);

  async function checkFfmpeg() {
    try {
      const exists = await invoke<boolean>("check_ffmpeg");
      setHasFfmpeg(exists);
      localStorage.setItem("hasFfmpeg", exists ? "true" : "false");
    } catch (e) {
      console.error("Failed to check ffmpeg:", e);
    }
  }

  async function installFfmpeg() {
    setInstallingFfmpeg(true);
    setFfmpegMessage({ text: "Downloading FFMPEG... This may take a minute.", error: false });
    try {
      await invoke("install_ffmpeg");
      setHasFfmpeg(true);
      localStorage.setItem("hasFfmpeg", "true");
      setFfmpegMessage({ text: "FFMPEG installed successfully!", error: false });
    } catch (e: any) {
      setFfmpegMessage({ text: `Failed to install: ${e.toString()}`, error: true });
    } finally {
      setInstallingFfmpeg(false);
    }
  }

  async function loadSettings() {
    const store = await load("settings.json", { autoSave: true });
    const path = await store.get<string>("downloadPath") || "";
    const format = await store.get<string>("defaultFormat") || "best";
    const savedTheme = await store.get<string>("theme") || "dark";
    const auth = await store.get<string>("browserAuth") || "none";
    const optimize = await store.get<boolean>("optimizeForMobile") || false;
    
    setDownloadPath(path);
    setDefaultFormat(format);
    setTheme(savedTheme);
    setBrowserAuth(auth);
    setOptimizeForMobile(optimize);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const store = await load("settings.json", { autoSave: true });
      await store.set("downloadPath", downloadPath);
      await store.set("defaultFormat", defaultFormat);
      await store.set("theme", theme);
      await store.set("browserAuth", browserAuth);
      await store.set("optimizeForMobile", optimizeForMobile);
      await store.save();
      console.log("Settings successfully saved to store.");
      
      // Apply theme
      document.body.className = theme;
      
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  }

  async function selectFolder() {
    try {
      const selected = await invoke<string | null>("select_folder");
      if (selected) {
        setDownloadPath(selected);
      }
    } catch (e) {
      console.error("Failed to select folder:", e);
    }
  }

  async function syncCookies() {
    if (browserAuth === "none") {
      setSyncMessage({ text: "Please select a browser first.", error: true });
      return;
    }
    setSyncing(true);
    setSyncMessage({ text: "Please ensure your browser is fully closed before syncing... Syncing now.", error: false });
    
    try {
      const res = await fetch("http://127.0.0.1:14222/sync_cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ browser: browserAuth })
      });
      if (res.ok) {
        setSyncMessage({ text: "Cookies synced successfully! You can now use Re-play while your browser is open.", error: false });
      } else {
        const text = await res.text();
        setSyncMessage({ text: `Failed to sync: ${text}`, error: true });
      }
    } catch (e: any) {
      setSyncMessage({ text: `Error: ${e.message}`, error: true });
    } finally {
      setSyncing(false);
    }
  }

  async function clearSyncedCookies() {
    try {
      await fetch("http://127.0.0.1:14222/clear_synced_cookies", { method: "POST" });
      setSyncMessage({ text: "Synced cookies cleared.", error: false });
    } catch (e: any) {
      setSyncMessage({ text: `Error clearing cookies: ${e.message}`, error: true });
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="header">
        <h1>Settings</h1>
        <p>Configure your Re-play preferences.</p>
      </div>

      <div className="settings-content card">
        <div className="settings-group">
          <label>Default Download Directory</label>
          <div className="input-group">
            <input 
              value={downloadPath} 
              readOnly 
              placeholder="System default Downloads folder"
              className="premium-input flex-1"
            />
            <button className="premium-btn secondary" onClick={selectFolder}>
              <FolderOpen size={16} />
              Browse
            </button>
          </div>
          <small>Where your downloaded media will be saved.</small>
        </div>

        <div className="settings-group">
          <label>Default Format</label>
          <select 
            value={defaultFormat} 
            onChange={e => setDefaultFormat(e.target.value)}
            className="premium-select full-width"
          >
            <option value="best">Best Quality (Video + Audio)</option>
            <option value="1080p">1080p Video</option>
            <option value="720p">720p Video</option>
            <option value="audio_only">Audio Only (MP3)</option>
          </select>
          {!hasFfmpeg && (defaultFormat === "1080p" || defaultFormat === "best") && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, color: "#ef4444", fontSize: "0.9rem" }}>
              <strong>Warning:</strong> You selected a high-quality format, but FFMPEG is not installed. 
              Please install FFMPEG in the section below, otherwise high-quality downloads will fail or fallback to 360p.
            </div>
          )}
        </div>

        <div className="settings-group">
          <label>Theme</label>
          <select 
            value={theme} 
            onChange={e => setTheme(e.target.value)}
            className="premium-select full-width"
          >
            <option value="dark">Dark Mode</option>
            <option value="light">Light Mode</option>
            <option value="glass">Glassmorphism</option>
          </select>
        </div>

        <div className="settings-group">
          <label>YouTube Authentication (Cookies)</label>
          <select 
            value={browserAuth} 
            onChange={e => setBrowserAuth(e.target.value)}
            className="premium-select full-width"
          >
            <option value="none">None (May cause 403 errors on 1080p)</option>
            <option value="chrome">Google Chrome</option>
            <option value="edge">Microsoft Edge</option>
            <option value="firefox">Mozilla Firefox</option>
            <option value="brave">Brave</option>
            <option value="safari">Safari</option>
            <option value="opera">Opera</option>
          </select>
          <small>Select your main browser to allow 1080p+ downloads without being blocked by YouTube.</small>
          
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button 
              className="premium-btn secondary" 
              onClick={syncCookies} 
              disabled={syncing || browserAuth === "none"}
            >
              {syncing ? "Syncing..." : "Sync Browser Cookies"}
            </button>
            <button 
              className="premium-btn danger outline" 
              onClick={clearSyncedCookies}
            >
              Clear Synced Cookies
            </button>
          </div>
          {syncMessage && (
            <p style={{ marginTop: 8, fontSize: "0.9rem", color: syncMessage.error ? "#ef4444" : "#10b981" }}>
              {syncMessage.text}
            </p>
          )}
        </div>

        <div className="settings-group">
          <label>FFMPEG Installation</label>
          <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: 12 }}>
            FFMPEG is required if you want to download high-quality videos (1080p+) because YouTube separates high-quality video and audio tracks. 
            If you only need 360p or Audio Only, FFMPEG is not required.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              backgroundColor: hasFfmpeg ? '#10b981' : '#ef4444'
            }} />
            <span style={{ fontWeight: 500 }}>
              {hasFfmpeg ? "FFMPEG is Installed" : "FFMPEG is Not Installed"}
            </span>
          </div>
          
          {!hasFfmpeg && (
            <div style={{ marginTop: 12 }}>
              <button 
                className="premium-btn primary" 
                onClick={installFfmpeg} 
                disabled={installingFfmpeg}
              >
                {installingFfmpeg ? "Installing..." : "Download & Install FFMPEG"}
              </button>
            </div>
          )}
          {ffmpegMessage && (
            <p style={{ marginTop: 8, fontSize: "0.9rem", color: ffmpegMessage.error ? "#ef4444" : "#10b981" }}>
              {ffmpegMessage.text}
            </p>
          )}
        </div>

        <div className="settings-group">
          <label>FFMPEG Device Optimization</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={optimizeForMobile} 
                onChange={e => setOptimizeForMobile(e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
            <span style={{ fontWeight: 500 }}>Optimize Videos for Mobile/TV (Slower Download)</span>
          </div>
          <small style={{ display: "block", marginTop: 8 }}>
            If enabled, FFMPEG will physically rebuild every downloaded video into a standard H.264 MP4. 
            This guarantees 100% compatibility on strict devices (like old iPhones or TVs) but takes significantly more CPU and time.
          </small>
        </div>

        <div className="settings-group">
          <label>App Updates</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button 
              className="premium-btn secondary" 
              onClick={() => checkForUpdates(false, setCheckingUpdates)} 
              disabled={checkingUpdates}
            >
              <RefreshCw size={16} className={checkingUpdates ? "spin" : ""} />
              {checkingUpdates ? "Checking..." : "Check for Updates"}
            </button>
          </div>
          <small style={{ display: "block", marginTop: 8 }}>
            Re-play automatically checks for updates on startup, but you can manually check here.
          </small>
        </div>

        <div className="settings-actions">
          <button className="premium-btn primary" onClick={saveSettings} disabled={saving}>
            <Save size={16} />
            {saving ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
