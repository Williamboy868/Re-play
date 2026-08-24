import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

export function UpdateChecker() {
  useEffect(() => {
    // Check if the app just updated by comparing current version to stored version
    checkIfJustUpdated();

    // Automatically check for new updates after 5 seconds of opening the app
    const timer = setTimeout(() => {
      checkForUpdates(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  async function checkIfJustUpdated() {
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      const currentVersion = await getVersion();
      const lastVersion = localStorage.getItem("re-play-version");

      if (lastVersion && lastVersion !== currentVersion) {
        await message(`Re-play has been successfully updated to v${currentVersion}!\\n\\nIMPORTANT: If this update included changes to the browser extension, you will need to go to the Settings tab, export the extension again, and reload it in your browser.`, {
          title: 'Update Complete',
          kind: 'info',
        });
      }
      
      // Store the current version for next time
      localStorage.setItem("re-play-version", currentVersion);
    } catch (e) {
      console.error("Failed to check version:", e);
    }
  }

  return null;
}

let isCheckingUpdates = false;

export async function checkForUpdates(silent: boolean, setChecking?: (checking: boolean) => void) {
  if (isCheckingUpdates) return;
  isCheckingUpdates = true;
  setChecking?.(true);
  try {
    const update = await check();
    if (update) {
      console.log(`found update ${update.version} from ${update.date} with notes ${update.body}`);
      const yes = await ask(`Update to ${update.version} is available!\\n\\nRelease notes: ${update.body || 'No release notes.'}\\n\\nWould you like to install it now?`, {
        title: 'Update Available',
        kind: 'info',
        okLabel: 'Update',
        cancelLabel: 'Cancel'
      });

      if (yes) {
        let downloaded = 0;
        let contentLength = 0;
        
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              console.log(`started downloading ${event.data.contentLength} bytes`);
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              console.log(`downloaded ${downloaded} from ${contentLength}`);
              break;
            case 'Finished':
              console.log('download finished');
              break;
          }
        });

        console.log('update installed');
        await relaunch();
      }
    } else if (!silent) {
      await message("You are on the latest version of Re-play.", {
        title: 'No Updates Found',
        kind: 'info',
      });
    }
  } catch (error) {
    console.error("Failed to check for updates:", error);
    if (!silent) {
      await message(`Failed to check for updates: ${error}`, {
        title: 'Error',
        kind: 'error',
      });
    }
  } finally {
    isCheckingUpdates = false;
    setChecking?.(false);
  }
}
