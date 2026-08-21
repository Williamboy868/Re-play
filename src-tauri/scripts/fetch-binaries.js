import fs from 'fs';
import path from 'path';
import https from 'https';

// Navigate from src-tauri/scripts/ to src-tauri/bin/
const BIN_DIR = path.join(process.cwd(), 'src-tauri', 'bin');

if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

const YT_DLP_URLS = {
  'x86_64-pc-windows-msvc': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  'aarch64-pc-windows-msvc': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  'x86_64-apple-darwin': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  'aarch64-apple-darwin': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  'x86_64-unknown-linux-gnu': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
  'aarch64-unknown-linux-gnu': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64',
};

const QUICKJS_URLS = {
  'x86_64-pc-windows-msvc': 'https://github.com/quickjs-ng/quickjs/releases/download/v0.16.1/qjs-windows-x86_64.exe',
  'aarch64-pc-windows-msvc': 'https://github.com/quickjs-ng/quickjs/releases/download/v0.16.1/qjs-windows-x86_64.exe', // Fallback x86_64 for Windows arm64
  'x86_64-apple-darwin': 'https://github.com/quickjs-ng/quickjs/releases/download/v0.16.1/qjs-darwin-x86_64',
  'aarch64-apple-darwin': 'https://github.com/quickjs-ng/quickjs/releases/download/v0.16.1/qjs-darwin-arm64',
  'x86_64-unknown-linux-gnu': 'https://github.com/quickjs-ng/quickjs/releases/download/v0.16.1/qjs-linux-x86_64',
  'aarch64-unknown-linux-gnu': 'https://github.com/quickjs-ng/quickjs/releases/download/v0.16.1/qjs-linux-aarch64',
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    options.rejectUnauthorized = false;
    https.get(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to get ${url} (${res.statusCode})`));
      }
      
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        fs.chmodSync(dest, 0o755);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function main() {
  const tasks = [];
  
  for (const [target, url] of Object.entries(YT_DLP_URLS)) {
    const ext = target.includes('windows') ? '.exe' : '';
    const dest = path.join(BIN_DIR, `yt-dlp-${target}${ext}`);
    if (!fs.existsSync(dest)) {
      tasks.push(downloadFile(url, dest));
    } else {
      console.log(`yt-dlp for ${target} already exists.`);
    }
  }

  for (const [target, url] of Object.entries(QUICKJS_URLS)) {
    const ext = target.includes('windows') ? '.exe' : '';
    const dest = path.join(BIN_DIR, `quickjs-${target}${ext}`);
    if (!fs.existsSync(dest)) {
      tasks.push(downloadFile(url, dest));
    } else {
      console.log(`quickjs for ${target} already exists.`);
    }
  }

  await Promise.all(tasks);
  console.log('All binaries fetched successfully.');
}

main().catch(console.error);
