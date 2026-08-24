import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { HiSearch, HiExternalLink, HiArrowLeft } from "react-icons/hi";
import { FaGithub, FaHeart } from "react-icons/fa";
import sitesData from "../data/sites";

export default function SupportedSites() {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return sitesData;
    const q = search.toLowerCase();
    return sitesData.filter((s) => s.toLowerCase().includes(q));
  }, [search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <>
      {/* ── Header ──────────────────────────── */}
      <section className="section" id="supported-sites-header">
        <Link to="/" className="back-link" id="back-to-home">
          <HiArrowLeft /> Back to Home
        </Link>

        <div className="section-header" style={{ marginTop: 24 }}>
          <span className="section-label">Compatibility</span>
          <h1 className="section-title">Supported Sites</h1>
          <p className="section-subtitle">
            Re-play supports downloading from <strong>{sitesData.length.toLocaleString()}</strong> websites
            and platforms. Search below to check if your favorite site is supported.
          </p>
        </div>

        {/* ── Search ──────────────────────────── */}
        <div className="sites-search-wrapper">
          <div className="sites-search" id="sites-search">
            <HiSearch className="sites-search-icon" />
            <input
              type="text"
              placeholder="Search sites… (e.g. YouTube, TikTok, Twitch)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(100);
              }}
              className="sites-search-input"
              id="sites-search-input"
            />
            {search && (
              <button
                className="sites-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <p className="sites-search-count">
            {search
              ? `${filtered.length.toLocaleString()} result${filtered.length !== 1 ? "s" : ""} found`
              : `${sitesData.length.toLocaleString()} sites total`}
          </p>
        </div>

        {/* ── Sites Grid ──────────────────────── */}
        {filtered.length === 0 ? (
          <div className="sites-empty">
            <p>No sites found matching "<strong>{search}</strong>"</p>
            <p className="sites-empty-hint">
              Even if a site isn't listed, it might still work via yt-dlp's generic extractor.{" "}
              <a
                href="https://github.com/yt-dlp/yt-dlp#readme"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more →
              </a>
            </p>
          </div>
        ) : (
          <>
            <div className="sites-grid" id="sites-grid">
              {visible.map((site) => (
                <div key={site} className="site-chip">
                  {site}
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="sites-load-more">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setVisibleCount((c) => c + 200)}
                  id="load-more-sites"
                >
                  Load more ({(filtered.length - visibleCount).toLocaleString()} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <div className="divider" />

      {/* ── yt-dlp Credit ─────────────────────── */}
      <section className="section" id="yt-dlp-credit">
        <div className="credit-card">
          <div className="credit-card-content">
            <div className="credit-icon">
              <FaHeart />
            </div>
            <div>
              <h2 className="credit-title">Powered by yt-dlp</h2>
              <p className="credit-desc">
                Re-play's download capabilities are powered by{" "}
                <a
                  href="https://github.com/yt-dlp/yt-dlp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  yt-dlp
                </a>
                , an incredible open-source project maintained by an amazing community of
                contributors. yt-dlp is a feature-rich command-line audio/video downloader
                that supports extracting media from thousands of websites.
              </p>
              <p className="credit-desc" style={{ marginTop: 12 }}>
                We are deeply grateful to the yt-dlp team for making this possible.
                If you find Re-play useful, please consider starring their repository too.
              </p>
            </div>
          </div>
          <div className="credit-actions">
            <a
              href="https://github.com/yt-dlp/yt-dlp"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
              id="yt-dlp-repo-link"
            >
              <FaGithub /> Visit yt-dlp
            </a>
            <a
              href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              id="yt-dlp-full-list-link"
            >
              <HiExternalLink /> Full Extractor List
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
