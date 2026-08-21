import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(() => localStorage.getItem("hasFfmpeg") === "true" ? 2 : 1);
  const [, setHasFfmpeg] = useState(() => localStorage.getItem("hasFfmpeg") === "true");
  const [installingFfmpeg, setInstallingFfmpeg] = useState(false);
  const [ffmpegMessage, setFfmpegMessage] = useState<{ text: string, error: boolean } | null>(null);
  const [showChromeModal, setShowChromeModal] = useState(false);
  const [zipPath, setZipPath] = useState("");

  useEffect(() => {
    checkFfmpeg();
  }, []);

  async function checkFfmpeg() {
    try {
      const exists = await invoke<boolean>("check_ffmpeg");
      setHasFfmpeg(exists);
      localStorage.setItem("hasFfmpeg", exists ? "true" : "false");
      if (exists) {
        // If they already have it, skip directly to extension step
        setStep(2);
      }
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
      setTimeout(() => setStep(2), 1500);
    } catch (e: any) {
      setFfmpegMessage({ text: `Failed to install: ${e.toString()}`, error: true });
      setInstallingFfmpeg(false);
    }
  }

  function handleGetEdge() {
    window.open("https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home", "_blank");
    localStorage.setItem("onboardingComplete", "true");
    onComplete();
  }

  function handleGetFirefox() {
    window.open("https://addons.mozilla.org/en-US/firefox/", "_blank");
    localStorage.setItem("onboardingComplete", "true");
    onComplete();
  }

  async function handleGetChrome() {
    try {
      const path = await invoke<string>("export_extension_zip");
      setZipPath(path);
      setShowChromeModal(true);
    } catch (e) {
      console.error("Failed to export zip", e);
    }
  }

  function completeChromeOnboarding() {
    setShowChromeModal(false);
    localStorage.setItem("onboardingComplete", "true");
    onComplete();
  }

  function handleAlreadyHaveExtension() {
    localStorage.setItem("onboardingComplete", "true");
    onComplete();
  }

  return (
    <div className="page-container fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <div className="card" style={{
        background: "rgba(30, 30, 35, 0.8)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 12,
        padding: "40px",
        textAlign: "center",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.3)",
        maxWidth: 600,
        width: "100%"
      }}>
        {step === 1 && (
          <div className="fade-in">
            <h2 style={{ margin: "0 0 16px 0", color: "#ffffff", fontSize: "1.7rem", fontWeight: 600 }}>
              Welcome to Re-play
            </h2>
            <p style={{ margin: "0 auto 24px auto", fontSize: "1.05rem", color: "#9ca3af", lineHeight: 1.6 }}>
              To download high-quality videos (1080p, 4K), Re-play requires an engine called <strong>FFMPEG</strong> to merge video and audio streams seamlessly.
            </p>
            
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 32 }}>
              <button 
                className="premium-btn primary" 
                onClick={installFfmpeg}
                disabled={installingFfmpeg}
                style={{ padding: "12px 24px", fontSize: "1rem" }}
              >
                {installingFfmpeg ? "Installing..." : "Install FFMPEG (Recommended)"}
              </button>
              <button 
                className="premium-btn secondary" 
                onClick={() => setStep(2)}
                disabled={installingFfmpeg}
                style={{ padding: "12px 24px", fontSize: "1rem" }}
              >
                Skip for now (360p only)
              </button>
            </div>
            {ffmpegMessage && (
              <p style={{ marginTop: 16, fontSize: "0.95rem", color: ffmpegMessage.error ? "#ef4444" : "#10b981" }}>
                {ffmpegMessage.text}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="fade-in">
            <h2 style={{ margin: "0 0 16px 0", color: "#ffffff", fontSize: "1.7rem", fontWeight: 600 }}>
              The Browser Extension
            </h2>
            <p style={{ margin: "0 auto 24px auto", fontSize: "1.05rem", color: "#9ca3af", lineHeight: 1.6 }}>
              Re-play uses a lightweight browser extension to capture downloads from 1000+ sites directly in your browser.
            </p>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
              {[
                { name: "YouTube", path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
                { name: "Twitter / X", path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" },
                { name: "TikTok", path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
                { name: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
                { name: "Reddit", path: "M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" },
                { name: "1000+ Sites", path: null }
              ].map(site => (
                <span key={site.name} style={{ 
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", background: "rgba(255, 255, 255, 0.05)", 
                  border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 20, 
                  fontSize: "0.85rem", color: "#e5e7eb", fontWeight: 500
                }}>
                  {site.path ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d={site.path} /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                  )}
                  {site.name}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 32, flexWrap: "wrap", flexDirection: "column" }}>
              <button 
                className="premium-btn primary" 
                onClick={handleGetEdge}
                style={{ padding: "10px 24px", fontSize: "1rem", width: "300px", margin: "0 auto" }}
              >
                Install for Microsoft Edge
              </button>
              <button 
                className="premium-btn primary" 
                onClick={handleGetFirefox}
                style={{ padding: "10px 24px", fontSize: "1rem", width: "300px", margin: "0 auto", background: "linear-gradient(45deg, #ff7171, #ff9e43)" }}
              >
                Install for Mozilla Firefox
              </button>
              <button 
                className="premium-btn primary" 
                onClick={handleGetChrome}
                style={{ padding: "10px 24px", fontSize: "1rem", width: "300px", margin: "0 auto", background: "linear-gradient(45deg, #34a853, #4285f4)" }}
              >
                Install for Chrome / Brave
              </button>
            </div>
            
            <div style={{ marginTop: 16 }}>
              <button 
                onClick={handleAlreadyHaveExtension}
                style={{ background: "none", border: "none", color: "#6b7280", fontSize: "0.9rem", cursor: "pointer", textDecoration: "underline" }}
              >
                I already have the extension
              </button>
            </div>
          </div>
        )}

        {showChromeModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="card fade-in" style={{ background: "#1e1e24", padding: 30, borderRadius: 12, maxWidth: 500, width: "100%", border: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
              <h2 style={{ marginTop: 0, color: "#4facfe" }}>Manual Installation Required</h2>
              <p style={{ color: "#e5e7eb" }}>We have successfully extracted the extension directly to your Downloads folder:</p>
              <div style={{ background: "rgba(255,255,255,0.05)", padding: 10, borderRadius: 6, margin: "10px 0", wordBreak: "break-all", fontSize: "0.9rem", color: "#a0a0a0" }}>
                {zipPath}
              </div>
              <p style={{ color: "#e5e7eb", marginTop: 20 }}>Please follow these 3 quick steps to install it:</p>
              <ol style={{ color: "#a0a0a0", lineHeight: 1.6 }}>
                <li>Open your browser and navigate to <strong>chrome://extensions</strong> (or <strong>brave://extensions</strong>)</li>
                <li>Turn on <strong>Developer mode</strong> in the top right corner.</li>
                <li>Click the <strong>"Load unpacked"</strong> button and select the <strong>Re-play Extension</strong> folder from your Downloads.</li>
              </ol>
              <button className="premium-btn primary" onClick={completeChromeOnboarding} style={{ marginTop: 20, width: "100%" }}>
                I have installed it! Let's go
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
