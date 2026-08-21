import fs from 'fs';
import path from 'path';

// Read version from package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Syncing version v${version} to extension manifest...`);

// Update extension/manifest.json
const manifestPath = path.join(process.cwd(), 'extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Extensions require versions like 1.0.0, 1.0.0.1 (can't have letters like -alpha)
// We'll just take the clean semver part
const cleanVersion = version.replace(/[^0-9.]/g, '');
manifest.version = cleanVersion;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Successfully updated extension/manifest.json to v${cleanVersion}`);

// Update src-tauri/tauri.conf.json
const tauriConfPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = cleanVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`Successfully updated src-tauri/tauri.conf.json to v${cleanVersion}`);
}
