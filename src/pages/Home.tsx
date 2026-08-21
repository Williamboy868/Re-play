import { useState, useEffect } from "react";
import { Onboarding } from "../components/Onboarding";

import { listen } from "@tauri-apps/api/event";

interface ProgressPayload {
  url: string;
  progress: string;
}

export function Home() {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, string>>({});
  const [onboardingComplete, setOnboardingComplete] = useState(() => localStorage.getItem("onboardingComplete") === "true");

  useEffect(() => {
    // Fetch initial active downloads state from backend
    fetch("http://127.0.0.1:14222/all_progress")
      .then(res => res.json())
      .then(data => {
        if (data) setActiveDownloads(data);
      })
      .catch(e => console.error("Failed to fetch initial progress:", e));

    const unlistenStarted = listen<string>("download-started", (event) => {
      setActiveDownloads((prev) => ({ ...prev, [event.payload]: "0%" }));
    });

    const unlistenProgress = listen<ProgressPayload>("download-progress", (event) => {
      setActiveDownloads((prev) => ({ ...prev, [event.payload.url]: event.payload.progress }));
    });

    const unlistenFinished = listen<string>("download-finished", () => {
      // Keep it in activeDownloads, just let it update its text via the map fetching or just rely on backend map
      // The rust backend will update the map to "100% (Completed)" or "Done (check logs for details)"
      // So we can actually just fetch the latest state from backend to sync, or wait for a potential final progress event.
      // But actually, it's safer to fetch the all_progress map again to get the exact final text string
      fetch("http://127.0.0.1:14222/all_progress")
        .then(res => res.json())
        .then(data => {
          if (data) setActiveDownloads(data);
        })
        .catch(e => console.error("Failed to fetch final progress:", e));
    });

    return () => {
      unlistenStarted.then(f => f());
      unlistenProgress.then(f => f());
      unlistenFinished.then(f => f());
    };
  }, []);



  async function clearFinished() {
    const finishedUrls = Object.entries(activeDownloads)
      .filter(([_, progress]) => progress.includes("Completed") || progress.includes("Done") || progress.includes("Error"))
      .map(([url, _]) => url);
      
    for (const dUrl of finishedUrls) {
      try {
        await fetch("http://127.0.0.1:14222/clear_progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: dUrl })
        });
      } catch (e) {
        console.error("Failed to clear progress for", dUrl, e);
      }
    }
    
    // Refresh list
    fetch("http://127.0.0.1:14222/all_progress")
      .then(res => res.json())
      .then(data => setActiveDownloads(data || {}))
      .catch(e => console.error("Failed to refresh progress:", e));
  }

  const hasFinished = Object.values(activeDownloads).some(p => p.includes("Completed") || p.includes("Done") || p.includes("Error"));

  return (
    <div className="page-container fade-in">
      <div className="header">
        <h1>Downloads Dashboard</h1>
        <p>Monitor your active downloads here.</p>
      </div>

      {!onboardingComplete ? (
        <Onboarding onComplete={() => setOnboardingComplete(true)} />
      ) : (
        <div className="card" style={{
          background: "rgba(30, 30, 35, 0.4)",
          border: "1px dashed rgba(255, 255, 255, 0.1)",
          borderRadius: 12,
          padding: "20px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <h3 style={{ margin: "0 0 8px 0", color: "#ffffff", fontSize: "1.1rem" }}>Ready for Downloads</h3>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.95rem" }}>
              Open a video on YouTube, Twitter, or any of the 1000+ supported sites and click the extension.
            </p>
          </div>
          <div style={{ color: "#10b981", display: "flex", alignItems: "center", gap: 8, fontWeight: 500, fontSize: "0.95rem" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            Listening
          </div>
        </div>
      )}

      <div className="dashboard">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Active Downloads</h2>
          {hasFinished && (
            <button className="premium-btn secondary" onClick={clearFinished} style={{ padding: "6px 12px", fontSize: "0.9rem" }}>
              Clear Finished
            </button>
          )}
        </div>
        
        {Object.keys(activeDownloads).length === 0 && (
          <p className="empty-state">No active downloads.</p>
        )}
        <div className="downloads-list">
          {Object.entries(activeDownloads).map(([dlUrl, progress]) => {
            const isFFmpeg = progress.includes("FFMPEG") || progress.includes("Processing");
            const isError = progress.includes("Error");
            const isCompleted = progress.includes("Completed") || progress.includes("Done");
            const parts = progress.split(" · ");
            const percentPart = parts[0] || progress;
            const detailsPart = parts.slice(1).join("  ·  ");
            
            // Extract numeric width for progress bar
            let barWidth = "0%";
            if (percentPart.includes("%")) {
              barWidth = percentPart.trim();
            } else if (isFFmpeg || progress === "NA") {
              barWidth = "100%";
            } else if (isError) {
              barWidth = "100%";
            } else if (isCompleted) {
              barWidth = "100%";
            }
            
            // Determine bar style class
            const isIndeterminate = isFFmpeg || progress === "NA";
            
            return (
              <div key={dlUrl} className="download-card fade-in">
                <div className="download-info">
                  <span className="download-url">{dlUrl}</span>
                  <div style={{ textAlign: "right" }}>
                    <span className="download-progress-text" style={isFFmpeg ? { color: "#f59e0b" } : undefined}>
                      {isFFmpeg ? "Processing with FFMPEG..." : percentPart === "NA" ? "Downloading..." : percentPart}
                    </span>
                    {detailsPart && !isFFmpeg && (
                      <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: 2 }}>
                        {detailsPart}
                      </div>
                    )}
                    {isFFmpeg && detailsPart && (
                      <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: 2 }}>
                        {detailsPart}
                      </div>
                    )}
                  </div>
                </div>
                <div className="progress-bar-bg">
                  <div 
                    className={`progress-bar-fill ${isIndeterminate ? "indeterminate" : ""} ${isError ? "error-bar" : ""} ${isFFmpeg ? "ffmpeg-bar" : ""}`}
                    style={{ width: barWidth }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
