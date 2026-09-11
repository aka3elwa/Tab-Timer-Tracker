let temporaryFlashTimer = null;

function formatBadgeTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function cleanDomain(urlOrHost) {
  if (!urlOrHost) return "";
  let text = String(urlOrHost).trim().toLowerCase();
  text = text.replace(/^https?:\/\//, "");
  text = text.replace(/^www\./, "");
  return text.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
}

async function evaluateBadgeStatus() {
  if (temporaryFlashTimer) return;

  try {
    const data = await chrome.storage.local.get(["targetDomain", "isPaused", "lastActiveTick"]);
    const target = cleanDomain(data.targetDomain || "");

    if (!target) {
      chrome.action.setBadgeText({ text: "" });
      return;
    }

    // Check if any open tab matches the target domain
    const tabs = await chrome.tabs.query({});
    const hasTargetTab = tabs.some(tab => tab.url && cleanDomain(tab.url).includes(target));

    // If tab is closed, OFF takes absolute priority over PAUSED
    if (!hasTargetTab) {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
      return;
    }

    // Tab is open: if user paused it, show pause badge
    if (Boolean(data.isPaused) === true) {
      chrome.action.setBadgeText({ text: "⏸" });
      chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
      return;
    }

    // Tab is open and not paused: check if actively ticking
    const isLive = (Date.now() - (data.lastActiveTick || 0)) < 3500;
    if (isLive) {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#059669" });
    } else {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
    }
  } catch (err) {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_BADGE") {
    if (temporaryFlashTimer) return;

    if (msg.status === "ACTIVE") {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#059669" });
    } else if (msg.status === "IDLE") {
      chrome.action.setBadgeText({ text: "IDLE" });
      chrome.action.setBadgeBackgroundColor({ color: "#d97706" });
    } else if (msg.status === "PAUSED") {
      evaluateBadgeStatus();
    } else if (msg.status === "OFF") {
      evaluateBadgeStatus();
    }
  } else if (msg.type === "FLASH_TIME") {
    if (temporaryFlashTimer) {
      clearTimeout(temporaryFlashTimer);
    }
    const timeStr = formatBadgeTime(msg.seconds || 0);
    chrome.action.setBadgeText({ text: timeStr });
    chrome.action.setBadgeBackgroundColor({ color: "#0284c7" });

    temporaryFlashTimer = setTimeout(() => {
      temporaryFlashTimer = null;
      evaluateBadgeStatus();
    }, 5000);
  }
});

chrome.tabs.onRemoved.addListener(evaluateBadgeStatus);
chrome.tabs.onUpdated.addListener(evaluateBadgeStatus);
chrome.tabs.onActivated.addListener(evaluateBadgeStatus);
chrome.windows.onFocusChanged.addListener(evaluateBadgeStatus);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.isPaused || changes.targetDomain)) {
    evaluateBadgeStatus();
  }
});