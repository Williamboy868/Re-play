# Changelog

All notable changes to this project are documented in this file.

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
