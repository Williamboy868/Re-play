import { useState, useEffect } from "react";
import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Trash2, FolderOpen, Play, History as HistoryIcon, RefreshCw } from "lucide-react";

interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  format: string;
  file_path: string;
  status: string;
  created_at: string;
}

export function History() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();

    // Auto-refresh history whenever a download finishes or starts
    const unlistenFinished = listen("download-finished", () => loadHistory());
    const unlistenStarted = listen("download-started", () => loadHistory());

    return () => {
      unlistenFinished.then(f => f());
      unlistenStarted.then(f => f());
    };
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      setErrorMsg(null);
      const db = await Database.load("sqlite:history.db");
      const result = await db.select<HistoryEntry[]>("SELECT * FROM history ORDER BY id DESC LIMIT 100");
      setHistory(result);
    } catch (e: any) {
      console.error("Failed to load history:", e);
      setErrorMsg(e.toString());
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    if (!window.confirm("Are you sure you want to clear your download history?")) return;
    try {
      const db = await Database.load("sqlite:history.db");
      await db.execute("DELETE FROM history");
      setHistory([]);
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
  }

  async function deleteEntry(id: number) {
    try {
      const db = await Database.load("sqlite:history.db");
      await db.execute("DELETE FROM history WHERE id = ?", [id]);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      console.error("Failed to delete entry:", e);
    }
  }

  async function openFolder(path: string) {
    try {
      await invoke("open_folder", { path });
    } catch (e) {
      console.error("Failed to open folder:", e);
      alert("Could not open the folder.");
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="header history-header">
        <div>
          <h1>Download History</h1>
          <p>View and manage your previous downloads.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="premium-btn secondary" onClick={loadHistory} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="premium-btn danger outline" onClick={clearHistory}>
            <Trash2 size={16} />
            Clear All
          </button>
        </div>
      </div>

      <div className="history-content card">
        {errorMsg ? (
          <div className="error-state">
            <p style={{ color: "red" }}>Error loading history: {errorMsg}</p>
          </div>
        ) : loading ? (
          <p className="loading-state">Loading history...</p>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <HistoryIcon size={48} className="empty-icon" />
            <p>Your history is empty.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.id} className="history-item">
                <div className="history-details">
                  <h3 title={entry.title}>{entry.title || entry.url}</h3>
                  <div className="history-meta">
                    <span className={`status-badge ${entry.status.toLowerCase()}`}>
                      {entry.status}
                    </span>
                    <span className="format-badge">{entry.format}</span>
                    <span className="date-badge">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="history-actions">
                  <button 
                    className="icon-btn" 
                    title="Open File Location"
                    onClick={() => openFolder(entry.file_path)}
                  >
                    <FolderOpen size={18} />
                  </button>
                  <button 
                    className="icon-btn" 
                    title="Play/Open File"
                    onClick={() => invoke("open_file", { path: entry.file_path })}
                  >
                    <Play size={18} />
                  </button>
                  <button 
                    className="icon-btn danger" 
                    title="Delete Record"
                    onClick={() => deleteEntry(entry.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
