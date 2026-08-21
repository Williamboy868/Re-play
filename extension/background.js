/**
 * Extracts the parent (registrable) domain from a hostname.
 * e.g. "music.youtube.com" -> "youtube.com", "youtube.com" -> null
 */
function getParentDomain(hostname) {
  const clean = hostname.replace(/^www\./, "");
  const parts = clean.split(".");
  if (parts.length > 2) {
    return parts.slice(1).join(".");
  }
  return null;
}

/**
 * Fetches cookies for both the exact domain and its parent domain,
 * then deduplicates by name+domain+path so yt-dlp gets the full set.
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download") {
    const urlObj = new URL(request.url);
    getAllCookiesForUrl(urlObj.hostname, (cookies) => {
      fetch("http://127.0.0.1:14222/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: request.url, format: request.format, extension_cookies: cookies })
      })
      .then(response => {
        if (response.ok) {
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: "Server returned " + response.status });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    });
    
    return true; // Keep the message channel open for the async response
  } else if (request.action === "get_formats") {
    const urlObj = new URL(request.url);
    getAllCookiesForUrl(urlObj.hostname, (cookies) => {
      fetch("http://127.0.0.1:14222/formats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: request.url, extension_cookies: cookies })
      })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, formats: data.qualities }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    });
    return true;
  }
});
