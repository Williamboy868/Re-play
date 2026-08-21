let trustedPolicy;
if (window.trustedTypes && trustedTypes.createPolicy) {
  try {
    trustedPolicy = trustedTypes.createPolicy('replay-extension', {
      createHTML: (string) => string
    });
  } catch (e) {
    trustedPolicy = { createHTML: (string) => string };
  }
} else {
  trustedPolicy = { createHTML: (string) => string };
}

/**
 * Injects a self-contained floating action button (FAB) directly onto document.body.
 * This approach is fully immune to YouTube layout changes — it never touches
 * YouTube's own DOM, so no selector maintenance is ever needed.
 */
function injectDownloadButton() {
  if (document.getElementById("replay-download-btn")) return;

  const isVideoPage = window.location.href.includes("youtube.com/watch") ||
                      window.location.href.includes("youtube.com/shorts/") ||
                      window.location.href.includes("instagram.com") ||
                      window.location.href.includes("tiktok.com") ||
                      window.location.href.includes("twitter.com") ||
                      window.location.href.includes("x.com") ||
                      window.location.href.includes("facebook.com") ||
                      window.location.href.includes("vimeo.com") ||
                      window.location.href.includes("twitch.tv") ||
                      window.location.href.includes("reddit.com");
  if (!isVideoPage) return;

  const fab = document.createElement("div");
  fab.id = "replay-download-btn";
  fab.setAttribute("role", "button");
  fab.setAttribute("tabindex", "0");
  fab.setAttribute("title", "Download with Re-play");

  const iconImg = document.createElement("img");
  iconImg.src = chrome.runtime.getURL("icon32.png");
  iconImg.alt = "Re-play";

  const label = document.createElement("span");
  label.textContent = "Download";

  fab.appendChild(iconImg);
  fab.appendChild(label);

  fab.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showReplayModal();
  });

  fab.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      showReplayModal();
    }
  });

  document.body.appendChild(fab);
}

function removeDownloadButton() {
  const btn = document.getElementById("replay-download-btn");
  if (btn) btn.remove();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_modal") {
    showReplayModal();
  }
});

function showReplayModal() {
  if (document.getElementById("replay-modal-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "replay-modal-overlay";
  
  const modal = document.createElement("div");
  modal.id = "replay-modal";
  
  modal.innerHTML = trustedPolicy.createHTML(`
    <div class="replay-modal-header">
      <h2>Re-play Options</h2>
      <button id="replay-modal-close">&times;</button>
    </div>
    <div class="replay-modal-body" id="replay-modal-selection">
      <p id="replay-modal-loading">Loading available qualities...</p>
      <div id="replay-format-buttons" style="display: none;"></div>
    </div>
    <div class="replay-modal-body" id="replay-modal-progress" style="display: none;">
      <p>Downloading...</p>
      <div class="replay-progress-text" id="replay-progress-percent">0%</div>
      <div class="replay-progress-status" id="replay-progress-status">Starting...</div>
      <div class="replay-progress-bg">
        <div class="replay-progress-fill" id="replay-progress-bar"></div>
      </div>
    </div>
  `);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById("replay-modal-close").onclick = () => {
    overlay.remove();
  };

  const url = window.location.href;
  chrome.runtime.sendMessage({ action: "get_formats", url: url }, (response) => {
    const loadingText = document.getElementById("replay-modal-loading");
    if (loadingText) loadingText.style.display = "none";
    
    const buttonsContainer = document.getElementById("replay-format-buttons");
    if (!buttonsContainer) return;
    
    buttonsContainer.style.display = "block";
    
    let buttonsHtml = '<button class="replay-format-btn" data-format="best">Best Quality (Video + Audio)</button>';
    
    if (response && response.success && response.formats) {
      response.formats.forEach(height => {
        buttonsHtml += `<button class="replay-format-btn" data-format="${height}p">${height}p Video</button>`;
      });
    }
    
    buttonsHtml += '<button class="replay-format-btn" data-format="audio_only">Audio Only (MP3)</button>';
    buttonsContainer.innerHTML = trustedPolicy.createHTML(buttonsHtml);
    
    const formatBtns = document.querySelectorAll(".replay-format-btn");
    formatBtns.forEach(btn => {
      btn.onclick = () => {
        const format = btn.getAttribute("data-format");
        startDownload(format);
      };
    });
  });
}

function startDownload(format) {
  document.getElementById("replay-modal-selection").style.display = "none";
  document.getElementById("replay-modal-progress").style.display = "block";
  const url = window.location.href;

  chrome.runtime.sendMessage(
    { action: "download", url: url, format: format },
    (response) => {
      if (response && response.success) {
        pollProgress(url);
      } else {
        document.getElementById("replay-progress-percent").innerText = "Error starting download";
        document.getElementById("replay-progress-percent").style.color = "#ff0844";
      }
    }
  );
}

function pollProgress(url) {
  const interval = setInterval(() => {
    if (!document.getElementById("replay-modal-overlay")) {
      clearInterval(interval);
      return;
    }
    
    fetch(`http://127.0.0.1:14222/progress?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.progress || data.progress === "Not found") return;

        const percentText = document.getElementById("replay-progress-percent");
        const barFill = document.getElementById("replay-progress-bar");
        const statusText = document.getElementById("replay-progress-status");

        // Format: "45.3% · 1.20MiB/s · ETA 00:30"
        const parts = data.progress.split(" · ");
        const percent = parts[0] ? parts[0].trim() : data.progress;
        const details = parts.slice(1).join("  ·  ");

        percentText.innerText = percent === "NA" ? "Downloading..." : percent;
        if (statusText) statusText.innerText = details;

        // Strip % and set bar width
        const numericPercent = parseFloat(percent.replace("%", ""));
        if (!isNaN(numericPercent)) {
          barFill.style.width = numericPercent + "%";
          barFill.style.animation = "none"; // Remove indeterminate animation if any
        } else if (percent === "NA" || (!data.progress.includes("Error") && !data.progress.includes("Done") && data.progress !== "Not found")) {
          barFill.style.width = "100%";
          // Optional inline indeterminate style
          barFill.style.backgroundImage = "linear-gradient(90deg, #4facfe 25%, #00f2fe 50%, #4facfe 75%)";
          barFill.style.backgroundSize = "200% 100%";
        }

        if (data.progress.includes("Completed")) {
          clearInterval(interval);
          percentText.style.color = "#43e97b";
          if (statusText) statusText.innerText = "Saved to your Downloads folder!";
          setTimeout(() => {
            const overlay = document.getElementById("replay-modal-overlay");
            if (overlay) overlay.remove();
          }, 3000);
        } else if (data.progress.includes("Error")) {
          clearInterval(interval);
          percentText.style.display = "none";
          if (statusText) {
            statusText.style.color = "#ff4757";
            statusText.innerText = data.progress;
          }
          barFill.style.width = "100%";
          barFill.style.backgroundColor = "#ff4757";
          barFill.style.animation = "none";
          barFill.style.backgroundImage = "none";
        }
      })
      .catch(e => console.error("Re-play progress fetch error:", e));
  }, 500); // Poll every 500ms for smoother bar updates
}

// Watch for YouTube SPA navigation (URL changes without full page reload)
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    removeDownloadButton();
    // Small delay so the new page URL is stable before we decide to show the button
    setTimeout(injectDownloadButton, 300);
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// Initial injection
injectDownloadButton();
