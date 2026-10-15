# Changelog

All notable changes to this project are documented in this file.

## [1.1.4] - 2026-10-15

### Fixed
- **Video Quality List Extraction**: Hardened format parsing in the backend to ensure video qualities are always extracted even if `yt-dlp` returns non-JSON warnings or multi-line output on stdout. Added fallback line-by-line JSON parsing and support for resolution-derived heights and floating-point dimensions.
- **Diagnostics & Error Logging**: Added explicit logging for `yt-dlp` format queries and captured `stderr` output in the backend for easier troubleshooting.

### Changed
- **Binary Provisioning**: Updated `fetch-binaries.js` with `--force` / `--update` flags and added an `update-binaries` npm script to easily refresh provisioned binaries to the latest upstream releases.

## [1.1.3] - 2026-08-25

### Added
- **Edge Add-ons Store**: Added direct links to the Microsoft Edge Add-ons store in the onboarding flow and website to provide a smoother installation experience for Edge users.

## [1.1.2] - 2026-08-24

### Added
- **Automatic App Updates**: Integrated the Tauri updater plugin to silently check GitHub Releases for new versions on startup.
- **Manual Update Check**: Added a "Check for Updates" button to the Settings page.
- **Update Notifications**: The app now displays a prompt with release notes when an update is found, allowing one-click installation and restart.
- **Extension Update Reminders**: Added a helpful post-update prompt to remind users to re-export and load the browser extension if they just installed a new desktop version.

## [1.1.1] - 2026-08-24

### Added
- **Public Website**: Migrated the landing page to a multi-page React SPA with routing.
- **Supported Sites Directory**: Added a new searchable page listing all 1,200+ websites supported by `yt-dlp`.

### Changed
- **Onboarding UX**: Streamlined the extension installation instructions in the desktop app, merging Chromium browsers (Chrome, Edge, Brave, Vivaldi) into a single, clearer flow.

### Fixed
- **Release CI/CD**: Fixed race condition in the GitHub Actions release workflow that caused the extension zip upload to fail (migrated to GitHub CLI).

## [1.1.0] - 2026-08-21

### Fixed
- **Extension Cookie Handling**: Fixed `HTTP 403 Forbidden` errors when downloading from subdomain URLs (e.g. `music.youtube.com`, `m.facebook.com`). The extension now collects cookies from both the exact subdomain and the parent domain, deduplicates them, and sends the full set to yt-dlp. Previously, only cookies scoped to the exact subdomain were sent, which caused authentication failures when yt-dlp redirected to the parent domain (e.g. `music.youtube.com` → `youtube.com`).

## [1.0.0] - Initial Release

### Added
- **Core Downloader**: Rust backend utilizing `yt-dlp` to download video and audio from thousands of websites.
- **Cross-Platform Binaries**: Automatic provisioning of `yt-dlp` and `FFMPEG` binaries for Windows, macOS, and Linux on first launch.
- **Chrome Extension**: Injects into the active tab to extract session cookies (including parent-domain cookies for subdomain sites), enabling downloads from authenticated sites (e.g., YouTube Age-Restricted, YouTube Music, Instagram).
- **Format Extraction**: Extension allows users to select between Best Quality, specific resolutions, or Audio Only (MP3).
- **Real-Time Progress UI**: Extension features a live progress bar tracking download percentage, ETA, and speed.
- **FFMPEG Optimization**: "Optimize for Mobile/TV" toggle in Settings to ensure downloads are strictly encoded to H.264 (yuv420p) and AAC for maximum iOS/Smart TV compatibility.
- **Native Pause & Resume**: Extension supports pausing and resuming active downloads seamlessly via `.part` files and Rust process management.
- **History Dashboard**: React frontend displaying a dynamic, searchable local SQLite database of all historical downloads with direct folder-opening links.
- **Auto-Recovery**: Closing and reopening the extension popup automatically re-attaches to the live progress bar of an active download.
