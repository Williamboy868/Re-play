/**
 * Extracts the parent (registrable) domain from a hostname.
 * e.g. "music.youtube.com" -> "youtube.com", "youtube.com" -> null
 */
function getParentDomain(hostname) {
  const clean = hostname.replace(/^www\./, "");
  const parts = clean.split(".");
  // Only extract parent if there are 3+ parts (sub.example.com)
  if (parts.length > 2) {
    return parts.slice(1).join("."); // e.g. "youtube.com"
  }
  return null; // already a root domain like "youtube.com"
}

/**
 * Fetches cookies for both the exact domain and its parent domain,
 * then deduplicates by name+domain+path so yt-dlp gets the full set.
 * This prevents 403s when yt-dlp redirects between subdomains
 * (e.g. music.youtube.com -> youtube.com).
 */
function getAllCookiesForUrl(hostname, callback) {
  const domain = hostname.replace(/^www\./, "");
  const parentDomain = getParentDomain(hostname);

  chrome.cookies.getAll({ domain: domain }, (cookies) => {
    if (!parentDomain) {
      callback(cookies || []);
      return;
    }

    chrome.cookies.getAll({ domain: parentDomain }, (parentCookies) => {
      // Merge and deduplicate: subdomain cookies take priority
      const seen = new Set();
      const merged = [];

      for (const c of (cookies || [])) {
        const key = `${c.name}|${c.domain}|${c.path}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(c);
        }
      }
      for (const c of (parentCookies || [])) {
        const key = `${c.name}|${c.domain}|${c.path}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(c);
        }
      }

      callback(merged);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const activeTab = tabs[0];
    const url = activeTab.url;
    
    // Attempt to load formats for the current URL
    document.getElementById("loading").style.display = "block";
    document.getElementById("selection").style.display = "none";
    
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // First check if a download is already active for this URL
    fetch(`http://127.0.0.1:14222/progress?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.progress && data.progress !== "Not found" && !data.progress.includes("Completed") && !data.progress.includes("Done") && !data.progress.includes("Error")) {
          // A download is active or paused! Recover the UI.
          document.getElementById("loading").style.display = "none";
          document.getElementById("selection").style.display = "none";
          document.getElementById("progress").style.display = "block";
          
          if (data.progress === "Paused") {
            document.getElementById("btn-pause").style.display = "none";
            document.getElementById("btn-resume").style.display = "block";
          }
          
          pollProgress(url, data.format || "best");
        } else {
          // No active download, fetch formats
          loadFormats(url);
        }
      })
      .catch(() => {
        // App might be closed, just show formats (it will fail anyway)
        loadFormats(url);
      });
  });
});

function loadFormats(url) {
    const urlObj = new URL(url);
    getAllCookiesForUrl(urlObj.hostname, (cookies) => {
      fetch(`http://127.0.0.1:14222/formats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url, extension_cookies: cookies })
      })
        .then(res => res.json())
        .then(data => {
          document.getElementById("loading").style.display = "none";
          document.getElementById("selection").style.display = "block";
        
        const container = document.getElementById("format-buttons");
        let html = '<button class="format-btn" data-format="best">Best Quality (Video + Audio)</button>';
        
        if (data && data.qualities && data.qualities.length > 0) {
          data.qualities.forEach(height => {
            html += `<button class="format-btn" data-format="${height}p">${height}p Video</button>`;
          });
        }
        
        html += '<button class="format-btn" data-format="audio_only">Audio Only (MP3)</button>';
        container.innerHTML = html;
        
        attachButtonListeners(url);
        })
        .catch(() => {
          document.getElementById("loading").style.display = "none";
          document.getElementById("selection").style.display = "block";
          attachButtonListeners(url);
        });
    });
}

function attachButtonListeners(url) {
  document.querySelectorAll(".format-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const format = btn.getAttribute("data-format");
      startDownload(url, format);
    });
  });
}

function startDownload(url, format) {
  document.getElementById("selection").style.display = "none";
  document.getElementById("progress").style.display = "block";
  
  const urlObj = new URL(url);

  getAllCookiesForUrl(urlObj.hostname, (cookies) => {
    fetch("http://127.0.0.1:14222/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format, extension_cookies: cookies })
    }).then(res => {
      if (res.ok) {
        document.getElementById("btn-pause").style.display = "block";
        document.getElementById("btn-resume").style.display = "none";
        pollProgress(url, format);
      } else {
        document.getElementById("progress-text").innerText = "Error starting download";
      }
    }).catch(err => {
      document.getElementById("progress-text").innerText = "Failed to connect to app";
    });
  });
}

function pollProgress(url, format) {
  const interval = setInterval(() => {
    fetch(`http://127.0.0.1:14222/progress?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.progress || data.progress === "Not found") return;

        const isFFmpeg = data.progress.includes("FFMPEG") || data.progress.includes("Processing with");
        const parts = data.progress.split(" · ");
        const percent = parts[0] ? parts[0].trim() : data.progress;
        const details = parts.slice(1).join("  ·  ");
        const bar = document.getElementById("progress-bar");

        // Reset bar classes
        bar.className = "progress-bar";
        const progressText = document.getElementById("progress-text");

        if (data.progress === "Paused") {
          progressText.innerText = "Paused";
          progressText.style.color = "#a0a0a0";
          document.getElementById("progress-status").innerText = "Download suspended";
          bar.classList.remove("ffmpeg");
          bar.style.width = "0%";
          bar.className = "progress-bar";
          
          // Ensure buttons match remote state
          document.getElementById("btn-pause").style.display = "none";
          document.getElementById("btn-resume").style.display = "block";
        } else if (isFFmpeg) {
          progressText.innerText = "Processing...";
          progressText.style.color = "#f59e0b";
          progressText.style.fontSize = "0.95rem";
          document.getElementById("progress-status").innerText = "Merging with FFMPEG";
          bar.classList.add("ffmpeg");
        } else if (percent.includes("%")) {
          progressText.innerText = percent;
          progressText.style.color = "";
          progressText.style.fontSize = "";
          document.getElementById("progress-status").innerText = details;
          bar.style.width = percent;
        } else {
          progressText.innerText = percent === "NA" ? "Downloading..." : percent;
          progressText.style.color = "";
          progressText.style.fontSize = "";
          document.getElementById("progress-status").innerText = details;
          
          // Ensure buttons match remote state (if downloading)
          document.getElementById("btn-pause").style.display = "block";
          document.getElementById("btn-resume").style.display = "none";
        }

        if (data.progress.includes("Completed")) {
          clearInterval(interval);
          document.getElementById("progress-text").innerText = "100% ✓";
          document.getElementById("progress-text").style.color = "#43e97b";
          document.getElementById("progress-status").innerText = "Saved to your Downloads folder!";
          bar.className = "progress-bar completed";
          bar.style.width = "100%";
        } else if (data.progress.includes("Done")) {
          clearInterval(interval);
          bar.className = "progress-bar completed";
          bar.style.width = "100%";
        } else if (data.progress.includes("Error")) {
          clearInterval(interval);
          document.getElementById("progress-text").style.color = "#ef4444";
          bar.className = "progress-bar error";
          bar.style.width = "100%";
        }
        
        if (data.progress.includes("Completed") || data.progress.includes("Done") || data.progress.includes("Error")) {
          document.getElementById("pause-resume-container").style.display = "none";
        }
      })
      .catch(e => console.error(e));
  }, 500);

  // Pause / Resume Logic
  const pauseBtn = document.getElementById("btn-pause");
  const resumeBtn = document.getElementById("btn-resume");
  
  // Clear old listeners if polling again
  const newPauseBtn = pauseBtn.cloneNode(true);
  pauseBtn.parentNode.replaceChild(newPauseBtn, pauseBtn);
  const newResumeBtn = resumeBtn.cloneNode(true);
  resumeBtn.parentNode.replaceChild(newResumeBtn, resumeBtn);

  newPauseBtn.addEventListener("click", () => {
    fetch("http://127.0.0.1:14222/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url })
    }).then(() => {
      newPauseBtn.style.display = "none";
      newResumeBtn.style.display = "block";
    });
  });

  newResumeBtn.addEventListener("click", () => {
    newResumeBtn.style.display = "none";
    newPauseBtn.style.display = "block";
    
    // We pass the stored format to resume
    startDownload(url, format);
  });
}
