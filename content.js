function cleanDomain(urlOrHost) {
  if (!urlOrHost) return "";
  let text = String(urlOrHost).trim().toLowerCase();
  text = text.replace(/^https?:\/\//, "");
  text = text.replace(/^www\./, "");
  return text.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
}

function isMatch(currentHost, target) {
  if (!target) return false;
  const cleanTarget = cleanDomain(target);
  const cleanCurrent = cleanDomain(currentHost);
  return cleanCurrent === cleanTarget || cleanCurrent.includes(cleanTarget);
}

let lastUserActivity = Date.now();
let idleTimeoutSec = 60;

chrome.storage.local.get(["idleTimeoutSec"], data => {
  if (data.idleTimeoutSec !== undefined) {
    idleTimeoutSec = Number(data.idleTimeoutSec);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.idleTimeoutSec) {
    idleTimeoutSec = Number(changes.idleTimeoutSec.newValue);
  }
});

function resetUserActivity() {
  lastUserActivity = Date.now();
}

["mousemove", "keydown", "scroll", "click", "touchstart"].forEach(event => {
  window.addEventListener(event, resetUserActivity, { passive: true });
});

setInterval(() => {
  if (document.hidden || document.visibilityState === "hidden") {
    return;
  }

  if (idleTimeoutSec > 0 && (Date.now() - lastUserActivity) > (idleTimeoutSec * 1000)) {
    try {
      chrome.runtime.sendMessage({ type: "SET_BADGE", status: "IDLE" }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
    return;
  }

  try {
    chrome.storage.local.get(["targetDomain", "totalSeconds", "sessionSeconds", "isPaused", "autoResetMidnight", "lastTrackedDate"], data => {
      if (chrome.runtime.lastError) return;

      if (Boolean(data.isPaused) === true) {
        try {
          chrome.runtime.sendMessage({ type: "SET_BADGE", status: "PAUSED" }, () => {
            if (chrome.runtime.lastError) {}
          });
        } catch (e) {}
        return;
      }

      const target = data.targetDomain || "";
      if (isMatch(window.location.hostname, target)) {
        const todayStr = new Date().toLocaleDateString("en-CA");
        let currentTotal = Number(data.totalSeconds || 0);

        if (Boolean(data.autoResetMidnight) === true && data.lastTrackedDate && data.lastTrackedDate !== todayStr) {
          currentTotal = 0;
        }

        const nextTotal = currentTotal + 1;
        const nextSession = Number(data.sessionSeconds || 0) + 1;

        chrome.storage.local.set({
          totalSeconds: nextTotal,
          sessionSeconds: nextSession,
          lastActiveTick: Date.now(),
          lastTrackedDate: todayStr
        });

        if (nextSession > 0 && nextSession % 900 === 0) {
          try {
            chrome.runtime.sendMessage({ type: "FLASH_TIME", seconds: nextSession }, () => {
              if (chrome.runtime.lastError) {}
            });
          } catch (e) {}
        } else {
          try {
            chrome.runtime.sendMessage({ type: "SET_BADGE", status: "ACTIVE" }, () => {
              if (chrome.runtime.lastError) {}
            });
          } catch (e) {}
        }
      } else {
        try {
          chrome.runtime.sendMessage({ type: "SET_BADGE", status: "OFF" }, () => {
            if (chrome.runtime.lastError) {}
          });
        } catch (e) {}
      }
    });
  } catch (err) {}
}, 1000);

function handleVisibilityChange() {
  if (document.visibilityState === "hidden") {
    try {
      chrome.runtime.sendMessage({ type: "SET_BADGE", status: "OFF" }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
  }
}

document.addEventListener("visibilitychange", handleVisibilityChange);