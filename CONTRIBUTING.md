# Contributing to Re-play Downloader

Welcome! This guide covers the architecture of the app and explains the build process, including how we manage cross-platform binaries and the browser extension.

## 🏗️ Architecture Overview

Re-play Downloader consists of three main parts:
1. **Frontend**: React + Vite (running in Tauri webview).
2. **Backend**: Rust + Tauri. The backend manages background processes like downloading media via `yt-dlp` and `FFmpeg`.
3. **Browser Extension**: Lives in the `extension/` folder. It extracts active browser session cookies and sends them to the local desktop app (via `http://127.0.0.1:14222`).

## 🛠️ Development Setup

### 1. Prerequisites
- Node.js (v20+)
- [Bun](https://bun.sh/) (used for fast package management and script execution)
- Rust toolchain (`rustup`)
- OS-specific Tauri dependencies (see the [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) guide).

### 2. Dependency Installation
Install the frontend dependencies using Bun:
```bash
bun install
```

### 3. Fetching Binaries
Re-play requires `yt-dlp` and `quickjs` (a lightweight JS runtime used by yt-dlp) to operate. Instead of committing these massive binaries to Git, we fetch them dynamically during the build step. 

The script `src-tauri/scripts/fetch-binaries.js` downloads the correct binaries for Windows, macOS, and Linux into the `src-tauri/bin/` folder. This runs automatically when you run `bun run build` or `bun run dev`.

### 4. Compiling the Browser Extension
The Re-play desktop app embeds the Chrome/Edge/Firefox extension directly into its binary so users can easily "export" it.
**IMPORTANT**: If you modify any code in the `extension/` folder, you must re-zip it into `re-play-extension.zip` in the root directory before running `bun run tauri build`.

**Windows:**
```powershell
mkdir -Force builds
Compress-Archive -Path "extension\*" -DestinationPath "builds\re-play-extension.zip" -Force
```

**macOS/Linux:**
```bash
mkdir -p builds
cd extension && zip -r ../builds/re-play-extension.zip * && cd ..
```

### 5. Running in Development
To start the app with hot module replacement (HMR):
```bash
bun run tauri dev
```

## 🚀 CI/CD Pipeline
We use GitHub Actions to automatically compile Re-play Downloader for Windows, macOS, and Ubuntu.
- The pipeline (`.github/workflows/build.yml`) will automatically fetch the required binaries.
- It will also automatically zip the `extension/` folder into `re-play-extension.zip` before compilation.
- The compiled `.exe`, `.dmg`, `.app`, and `.AppImage` files will be attached to the GitHub release.

### Creating a Release
To publish a new version of the app to users:
1. Update the version number in `package.json` (e.g., from `"0.1.0"` to `"1.0.0"`).
   - *(Note: The extension version is automatically synchronized via `src-tauri/scripts/sync-version.js` during the build process).*
2. Commit and push your changes to GitHub.
3. Create and push a Git tag formatted with a `v` prefix:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. This will trigger the `.github/workflows/release.yml` pipeline. It will build the app for all platforms and automatically create a GitHub Release titled "Re-play Downloader v1.0.0" with all the installer binaries attached.

## ⚠️ Notes on `.gitignore`
Never commit the `re-play-extension.zip`, the `src-tauri/target/` folder, or the binaries in `src-tauri/bin/`. These are generated automatically and are ignored in our `.gitignore` to keep the repository lightweight.
