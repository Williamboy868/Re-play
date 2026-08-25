import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaWindows,
  FaApple,
  FaLinux,
  FaChrome,
  FaGithub,
} from "react-icons/fa";
import {
  HiDownload,
  HiPlay,
  HiShieldCheck,
  HiClock,
  HiDatabase,
  HiSparkles,
  HiDesktopComputer,
  HiPuzzle,
  HiGlobeAlt,
} from "react-icons/hi";

// ─── Types ───────────────────────────────────────────────────
interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface ReleaseData {
  tag_name: string;
  assets: ReleaseAsset[];
}

interface PlatformDownload {
  name: string;
  icon: React.ReactNode;
  fileHint: string;
  format: string;
  url: string | null;
  size: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────
function detectOS(): "windows" | "macos" | "linux" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "windows";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function findAsset(
  assets: ReleaseAsset[],
  pattern: RegExp
): ReleaseAsset | undefined {
  return assets.find((a) => pattern.test(a.name));
}

const REPO = "Williamboy868/Re-play";
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

// ─── Home Page ───────────────────────────────────────────────
export default function Home() {
  const [release, setRelease] = useState<ReleaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const userOS = detectOS();

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data: ReleaseData) => {
        setRelease(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build platform download info
  const platforms: PlatformDownload[] = (() => {
    const assets = release?.assets ?? [];
    const win = findAsset(assets, /\.exe$/i);
    const mac = findAsset(assets, /\.dmg$/i);
    const linux =
      findAsset(assets, /\.AppImage$/i) ?? findAsset(assets, /\.deb$/i);

    return [
      {
        name: "Windows",
        icon: <FaWindows />,
        fileHint: ".exe installer",
        format: "exe",
        url: win?.browser_download_url ?? null,
        size: win ? formatBytes(win.size) : null,
      },
      {
        name: "macOS",
        icon: <FaApple />,
        fileHint: ".dmg disk image",
        format: "dmg",
        url: mac?.browser_download_url ?? null,
        size: mac ? formatBytes(mac.size) : null,
      },
      {
        name: "Linux",
        icon: <FaLinux />,
        fileHint: ".AppImage / .deb",
        format: "AppImage",
        url: linux?.browser_download_url ?? null,
        size: linux ? formatBytes(linux.size) : null,
      },
    ];
  })();

  const extensionAsset = release
    ? findAsset(release.assets, /re-play-extension\.zip$/i)
    : undefined;

  const primaryPlatform =
    platforms.find(
      (p) => p.name.toLowerCase() === (userOS === "macos" ? "macos" : userOS)
    ) ?? platforms[0];

  return (
    <>
      {/* ── Hero ─────────────────────────────── */}
      <section className="hero" id="hero">
        <div className="hero-logo-wrapper fade-in-up">
          <div className="hero-logo-glow" />
          <img src="/replay.png" alt="Re-play" className="hero-logo" />
        </div>

        <h1 className="hero-title fade-in-up fade-in-up-delay-1">
          Download Anything.{" "}
          <span className="hero-title-gradient">Re-play It.</span>
        </h1>

        <p className="hero-subtitle fade-in-up fade-in-up-delay-2">
          A powerful, cross-platform media downloader. Grab video and audio
          from YouTube, Instagram, TikTok, Twitter/X and{" "}
          <Link to="/supported-sites" style={{ color: "var(--accent)" }}>
            <strong>1,200+ sites</strong>
          </Link>{" "}
          directly to your desktop.
        </p>

        <div className="hero-actions fade-in-up fade-in-up-delay-3">
          <a
            href={primaryPlatform.url ?? RELEASES_URL}
            target={primaryPlatform.url ? undefined : "_blank"}
            rel={primaryPlatform.url ? undefined : "noopener noreferrer"}
            className="btn btn-primary"
            id="hero-download-btn"
          >
            <span className="btn-icon">{primaryPlatform.icon}</span>
            Download for {primaryPlatform.name}
          </a>
          <a
            href="#downloads"
            className="btn btn-secondary"
            id="hero-all-platforms-btn"
          >
            All Platforms
          </a>
        </div>
      </section>

      {/* ── Supported Sites Strip ──────────────── */}
      <div className="sites-strip fade-in-up fade-in-up-delay-4">
        <p>Works with your favorite sites</p>
        <div className="sites-logos">
          {[
            "YouTube",
            "Instagram",
            "TikTok",
            "Twitter / X",
            "Facebook",
            "Reddit",
            "Twitch",
            "SoundCloud",
          ].map((site) => (
            <span key={site} className="site-name">
              {site}
            </span>
          ))}
          <Link
            to="/supported-sites"
            className="site-name"
            style={{ color: "var(--accent)", opacity: 0.8 }}
          >
            +1200 more →
          </Link>
        </div>
      </div>

      <div className="divider" />

      {/* ── Downloads ────────────────────────── */}
      <section className="section" id="downloads">
        <div className="section-header">
          <span className="section-label">Downloads</span>
          <h2 className="section-title">Get Re-play for Your Platform</h2>
          <p className="section-subtitle">
            Available on Windows, macOS, and Linux. Free and open source.
          </p>
        </div>

        <div className="download-grid">
          {platforms.map((platform) => {
            const isHighlighted =
              platform.name.toLowerCase() ===
              (userOS === "macos" ? "macos" : userOS);
            return (
              <div
                key={platform.name}
                className={`download-card fade-in-up ${isHighlighted ? "highlighted" : ""}`}
                id={`download-card-${platform.name.toLowerCase()}`}
              >
                <span className="recommended-badge">Recommended</span>
                <div className="download-card-icon">{platform.icon}</div>
                <h3 className="download-card-title">{platform.name}</h3>
                <p className="download-card-subtitle">
                  {platform.fileHint}
                  {platform.size && ` · ${platform.size}`}
                </p>
                {loading ? (
                  <div
                    className="skeleton skeleton-text"
                    style={{ width: "100%", height: 44 }}
                  />
                ) : (
                  <a
                    href={platform.url ?? RELEASES_URL}
                    target={platform.url ? undefined : "_blank"}
                    rel={platform.url ? undefined : "noopener noreferrer"}
                    className={`btn ${isHighlighted ? "btn-primary" : "btn-secondary"} btn-sm`}
                    id={`download-btn-${platform.name.toLowerCase()}`}
                  >
                    <HiDownload />
                    Download
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Extension */}
        <div className="extension-card fade-in-up" id="download-extension">
          <div className="extension-card-content">
            <div className="extension-card-icon">
              <FaChrome />
            </div>
            <div>
              <h3 className="extension-card-title">Browser Extension</h3>
              <p className="extension-card-desc">
                One-click downloads right from your browser. Works with Chrome, Edge, Brave, Vivaldi, Opera, and other Chromium browsers.
              </p>
            </div>
          </div>
          {loading ? (
            <div
              className="skeleton skeleton-text"
              style={{ width: 140, height: 40 }}
            />
          ) : (
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <a
                href="https://microsoftedge.microsoft.com/addons/detail/replay-downloader/hcbaomikklgllbijkmoiiigcmepgkama"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                id="download-btn-edge"
              >
                <HiDownload />
                Edge Store
              </a>
              <a
                href={extensionAsset?.browser_download_url ?? RELEASES_URL}
                target={extensionAsset ? undefined : "_blank"}
                rel={extensionAsset ? undefined : "noopener noreferrer"}
                className="btn btn-secondary btn-sm"
                id="download-btn-extension"
              >
                <HiDownload />
                Download .zip
                {extensionAsset && (
                  <span
                    style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}
                  >
                    ({formatBytes(extensionAsset.size)})
                  </span>
                )}
              </a>
            </div>
          )}
        </div>

        <div className="older-versions">
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            id="older-versions-link"
          >
            Looking for an older version? →
          </a>
        </div>
      </section>

      <div className="divider" />

      {/* ── Features ─────────────────────────── */}
      <section className="section" id="features">
        <div className="section-header">
          <span className="section-label">Features</span>
          <h2 className="section-title">Everything You Need</h2>
          <p className="section-subtitle">
            Built for speed, quality, and ease of use.
          </p>
        </div>

        <div className="features-grid">
          {[
            {
              icon: <HiPlay />,
              title: "One-Click Downloads",
              desc: "Works seamlessly with the companion browser extension for instant downloading from any supported site.",
            },
            {
              icon: <HiSparkles />,
              title: "4K & MP3 Support",
              desc: "Download in 1080p, 4K video quality or extract audio as MP3. You choose the format and quality.",
            },
            {
              icon: <HiShieldCheck />,
              title: "Authenticated Downloads",
              desc: "Session cookies bypass age restrictions and login requirements — no credentials stored.",
            },
            {
              icon: <HiClock />,
              title: "Pause & Resume",
              desc: "Pause downloads and pick up right where you left off. No progress lost, ever.",
            },
            {
              icon: <HiDatabase />,
              title: "History Dashboard",
              desc: "Local SQLite database tracks all your downloads with a searchable, filterable UI.",
            },
            {
              icon: <HiDesktopComputer />,
              title: "Cross-Platform",
              desc: "Runs natively on Windows, macOS, and Linux. Built with Tauri and Rust for a lightweight footprint.",
            },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className={`feature-card fade-in-up fade-in-up-delay-${i + 1}`}
              id={`feature-${i}`}
            >
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* ── How It Works ─────────────────────── */}
      <section className="section" id="how-it-works">
        <div className="section-header">
          <span className="section-label">How It Works</span>
          <h2 className="section-title">Up and Running in 3 Steps</h2>
        </div>

        <div className="steps-grid">
          {[
            {
              icon: <HiDownload />,
              title: "Install Re-play",
              desc: "Download and install the desktop app for your OS. Everything is set up automatically on first launch.",
            },
            {
              icon: <HiPuzzle />,
              title: "Add the Extension",
              desc: "Install the browser extension in Chrome, Edge, Brave, Vivaldi, or Opera. It connects to the desktop app locally.",
            },
            {
              icon: <HiGlobeAlt />,
              title: "Download Anything",
              desc: "Visit any supported site, click the extension, choose your format, and the download starts instantly.",
            },
          ].map((step, i) => (
            <div
              key={step.title}
              className={`step-card fade-in-up fade-in-up-delay-${i + 1}`}
            >
              <div className="step-number">
                <span className="step-icon">{step.icon}</span>
              </div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
