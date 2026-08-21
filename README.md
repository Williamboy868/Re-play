<div align="center">
  <img src="public/replay.png" alt="Re-play Logo" width="150" />
  <h1>Re-play Downloader</h1>
  <p><b>Download video and audio from 1000+ sites directly to your desktop.</b></p>
</div>
<br />

Re-play Downloader is a powerful, cross-platform media downloader built with Tauri, React, and Rust. It allows you to download video and audio from over 1,000 websites (including YouTube, Instagram, TikTok, and Twitter/X) directly to your desktop.

## 🚀 Features

- **One-Click Downloads**: Works seamlessly with the companion browser extension for instant downloading.
- **High Quality**: Supports 1080p, 4K video, and MP3 audio extraction.
- **Authenticated Downloads**: The browser extension passes session cookies locally to bypass age restrictions or login requirements.
- **Cross-Platform**: Available on Windows, macOS, and Linux.
- **Built-in FFMPEG**: Automatically provisions `yt-dlp` and `FFMPEG` on first launch.
- **History Dashboard**: Local SQLite database to track and manage all your historical downloads.
- **Pause & Resume**: Support for pausing and resuming active downloads.

## 🏗️ Architecture

- **Frontend**: React, TypeScript, Vite
- **Backend**: Rust, Tauri
- **Core Engine**: `yt-dlp` for extraction, `FFMPEG` for merging video/audio streams.
- **Browser Extension**: A lightweight Chrome/Edge/Firefox extension that communicates with the desktop app via a local HTTP server (`127.0.0.1:14222`).

## 🛠️ Developer Setup

### Prerequisites
- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Dependencies](https://tauri.app/v1/guides/getting-started/prerequisites)

### Running Locally

1. Install Node dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run tauri dev
   ```

### Building the Browser Extension

If you make changes to the `extension/` folder, you must rebuild the extension ZIP file into the `builds/` directory before building the main app:

**Windows (PowerShell):**
```powershell
mkdir -Force builds
Compress-Archive -Path "extension\*" -DestinationPath "builds\re-play-extension.zip" -Force
```

**macOS/Linux:**
```bash
mkdir -p builds
cd extension && zip -r ../builds/re-play-extension.zip * && cd ..
```

### Building for Production

```bash
npm run tauri build
```

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgements
Re-play Downloader wouldn't be possible without these incredible open-source projects:
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The core extraction engine that powers media downloading.
- [FFmpeg](https://github.com/FFmpeg/FFmpeg) - The multimedia framework used for flawlessly merging video and audio streams.
