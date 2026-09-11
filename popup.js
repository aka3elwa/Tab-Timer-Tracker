function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = num => String(num).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function checkMidnightRollover(data) {
  const todayStr = new Date().toLocaleDateString("en-CA");
  if (Boolean(data.autoResetMidnight) === true && data.lastTrackedDate && data.lastTrackedDate !== todayStr) {
    chrome.storage.local.set({
      totalSeconds: 0,
      sessionSeconds: 0,
      lastTrackedDate: todayStr,
      lastActiveTick: 0
    });
    return true;
  }
  return false;
}

function archiveLog(seconds, domain, callback) {
  if (seconds >= 5 && domain) {
    const todayStr = new Date().toLocaleDateString("en-CA");
    chrome.storage.local.get(["dailyLogs"], data => {
      const logs = Array.isArray(data.dailyLogs) ? data.dailyLogs : [];
      logs.unshift({
        date: todayStr,
        domain: domain,
        seconds: seconds
      });

      const trimmed = logs.slice(0, 20);
      chrome.storage.local.set({ dailyLogs: trimmed }, () => {
        if (callback) callback();
      });
    });
    return;
  }
  if (callback) callback();
}

function renderHistoryUI() {
  chrome.storage.local.get(["dailyLogs"], data => {
    const list = document.getElementById("historyList");
    if (!list) return;

    const logs = Array.isArray(data.dailyLogs) ? data.dailyLogs : [];

    if (logs.length === 0) {
      list.innerHTML = `<div class="history-empty">No history recorded yet</div>`;
      return;
    }

    list.innerHTML = logs.map(item => {
      return `
        <div class="history-row">
          <span class="history-date">${item.date} <small style="color:#64748b;">(${item.domain})</small></span>
          <span class="history-time">${formatTime(item.seconds)}</span>
        </div>
      `;
    }).join("");
  });
}

function cleanInputDomain(value) {
  if (!value) return "";
  let text = String(value).trim().toLowerCase();
  text = text.replace(/^https?:\/\//, "");
  text = text.replace(/^www\./, "");
  return text.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
}

function applyNewDomain(newDomain) {
  if (!newDomain) return;

  chrome.storage.local.get(["targetDomain", "totalSeconds"], data => {
    const currentDomain = data.targetDomain || "";

    if (newDomain !== currentDomain) {
      archiveLog(Number(data.totalSeconds || 0), currentDomain, () => {
        chrome.storage.local.set({
          targetDomain: newDomain,
          totalSeconds: 0,
          sessionSeconds: 0,
          lastActiveTick: 0,
          isPaused: false
        }, () => {
          renderUI();
          renderHistoryUI();
        });
      });
    } else {
      chrome.storage.local.set({ targetDomain: newDomain }, () => {
        renderUI();
      });
    }
  });
}

async function renderUI() {
  chrome.storage.local.get(
    ["targetDomain", "totalSeconds", "sessionSeconds", "lastActiveTick", "isPaused", "autoResetMidnight", "lastTrackedDate"],
    async data => {
      let currentSeconds = Number(data.totalSeconds || 0);

      if (checkMidnightRollover(data)) {
        currentSeconds = 0;
      }

      const display = document.getElementById("timeDisplay");
      const sessionDisplay = document.getElementById("sessionDisplay");
      const badge = document.getElementById("statusBadge");
      const domainLabel = document.getElementById("currentTrackedDomain");
      const pauseBtn = document.getElementById("pauseBtn");

      display.textContent = formatTime(currentSeconds);
      if (sessionDisplay) {
        sessionDisplay.textContent = formatTime(Number(data.sessionSeconds || 0));
      }

      if (pauseBtn) {
        pauseBtn.textContent = data.isPaused ? "Resume" : "Pause";
        pauseBtn.className = data.isPaused ? "btn-primary" : "btn-secondary";
      }

      const target = cleanInputDomain(data.targetDomain || "");

      if (!target) {
        badge.textContent = "OFF";
        badge.className = "badge off";
      } else {
        const tabs = await chrome.tabs.query({});
        const hasTargetTab = tabs.some(tab => tab.url && cleanInputDomain(tab.url).includes(target));

        if (!hasTargetTab) {
          badge.textContent = "OFF";
          badge.className = "badge off";
        } else if (data.isPaused) {
          badge.textContent = "PAUSED";
          badge.className = "badge paused";
        } else {
          const isLive = (Date.now() - (data.lastActiveTick || 0)) < 3500;
          if (isLive) {
            badge.textContent = "TRACKING";
            badge.className = "badge active";
          } else {
            badge.textContent = "OFF";
            badge.className = "badge off";
          }
        }
      }

      if (data.targetDomain) {
        domainLabel.textContent = `Target: ${data.targetDomain}`;
      } else {
        domainLabel.textContent = "No domain set";
      }
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const domainInput = document.getElementById("domainInput");
  const useCurrentTabBtn = document.getElementById("useCurrentTabBtn");
  const saveDomainBtn = document.getElementById("saveDomainBtn");
  const clearDomainBtn = document.getElementById("clearDomainBtn");
  const saveSessionBtn = document.getElementById("saveSessionBtn");
  const sessionResetPrompt = document.getElementById("sessionResetPrompt");
  const confirmResetSessionBtn = document.getElementById("confirmResetSessionBtn");
  const dismissPromptBtn = document.getElementById("dismissPromptBtn");
  const resetSessionBtn = document.getElementById("resetSessionBtn");
  const resetTotalBtn = document.getElementById("resetTotalBtn");
  const copyBtn = document.getElementById("copyBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const settingsToggleBtn = document.getElementById("settingsToggleBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const autoResetToggle = document.getElementById("autoResetToggle");
  const idleTimeoutSelect = document.getElementById("idleTimeoutSelect");
  const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
  const historyCard = document.getElementById("historyCard");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  chrome.storage.local.get(["targetDomain"], data => {
    if (data.targetDomain) {
      domainInput.value = data.targetDomain;
    }
  });

  saveDomainBtn.addEventListener("click", () => {
    const cleaned = cleanInputDomain(domainInput.value);
    applyNewDomain(cleaned);
  });

  // Clear / Delete Target Domain
  clearDomainBtn.addEventListener("click", () => {
    chrome.storage.local.get(["targetDomain", "totalSeconds"], data => {
      const currentDomain = data.targetDomain || "";
      if (!currentDomain && !domainInput.value) return;

      archiveLog(Number(data.totalSeconds || 0), currentDomain, () => {
        chrome.storage.local.set({
          targetDomain: "",
          totalSeconds: 0,
          sessionSeconds: 0,
          lastActiveTick: 0,
          isPaused: false
        }, () => {
          domainInput.value = "";
          try {
            chrome.runtime.sendMessage({ type: "SET_BADGE", status: "OFF" }, () => {
              if (chrome.runtime.lastError) {}
            });
          } catch (e) {}
          renderUI();
          renderHistoryUI();
        });
      });
    });
  });

  useCurrentTabBtn.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.startsWith("http")) {
        const urlObj = new URL(tab.url);
        const cleaned = cleanInputDomain(urlObj.hostname);
        domainInput.value = cleaned;
        applyNewDomain(cleaned);
      }
    } catch (err) {
      console.error("Failed to get current tab:", err);
    }
  });

  saveSessionBtn.addEventListener("click", () => {
    chrome.storage.local.get(["sessionSeconds", "targetDomain"], data => {
      const sessionSec = Number(data.sessionSeconds || 0);
      if (sessionSec < 5) {
        alert("Session is too short to save (under 5 seconds).");
        return;
      }
      archiveLog(sessionSec, data.targetDomain || "Custom Session", () => {
        renderHistoryUI();
        sessionResetPrompt.classList.add("open");
      });
    });
  });

  confirmResetSessionBtn.addEventListener("click", () => {
    chrome.storage.local.set({ sessionSeconds: 0 }, () => {
      sessionResetPrompt.classList.remove("open");
      renderUI();
    });
  });

  dismissPromptBtn.addEventListener("click", () => {
    sessionResetPrompt.classList.remove("open");
  });

  resetSessionBtn.addEventListener("click", () => {
    chrome.storage.local.set({ sessionSeconds: 0 }, () => {
      renderUI();
    });
  });

  resetTotalBtn.addEventListener("click", () => {
    if (confirm("Reset total tracked time to 00:00:00? (Saved to history)")) {
      chrome.storage.local.get(["totalSeconds", "targetDomain"], data => {
        archiveLog(Number(data.totalSeconds || 0), data.targetDomain || "Total Day", () => {
          chrome.storage.local.set({ totalSeconds: 0, sessionSeconds: 0, lastActiveTick: 0 }, () => {
            renderUI();
            renderHistoryUI();
          });
        });
      });
    }
  });

  copyBtn.addEventListener("click", () => {
    const text = document.getElementById("timeDisplay").textContent;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy Time"), 1500);
    });
  });

  pauseBtn.addEventListener("click", () => {
    chrome.storage.local.get(["isPaused"], data => {
      const newState = !data.isPaused;
      const updates = { isPaused: newState };
      if (newState) {
        updates.lastActiveTick = 0;
      }
      chrome.storage.local.set(updates, () => {
        try {
          chrome.runtime.sendMessage({ type: "SET_BADGE", status: newState ? "PAUSED" : "OFF" }, () => {
            if (chrome.runtime.lastError) {}
          });
        } catch (e) {}
        renderUI();
      });
    });
  });

  settingsToggleBtn.addEventListener("click", () => {
    settingsPanel.classList.toggle("open");
  });

  chrome.storage.local.get(["autoResetMidnight", "idleTimeoutSec"], data => {
    autoResetToggle.checked = Boolean(data.autoResetMidnight);
    idleTimeoutSelect.value = data.idleTimeoutSec !== undefined ? String(data.idleTimeoutSec) : "60";
  });

  autoResetToggle.addEventListener("change", () => {
    const isEnabled = autoResetToggle.checked;
    const todayStr = new Date().toLocaleDateString("en-CA");
    chrome.storage.local.set({
      autoResetMidnight: isEnabled,
      lastTrackedDate: todayStr
    });
  });

  idleTimeoutSelect.addEventListener("change", () => {
    chrome.storage.local.set({ idleTimeoutSec: Number(idleTimeoutSelect.value) });
  });

  toggleHistoryBtn.addEventListener("click", () => {
    historyCard.classList.toggle("open");
    if (historyCard.classList.contains("open")) {
      renderHistoryUI();
    }
  });

  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Clear all recorded history?")) {
      chrome.storage.local.set({ dailyLogs: [] }, () => {
        renderHistoryUI();
      });
    }
  });

  chrome.storage.onChanged.addListener(() => renderUI());

  renderUI();
  setInterval(renderUI, 1000);
});