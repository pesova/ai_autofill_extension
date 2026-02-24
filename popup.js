document.addEventListener("DOMContentLoaded", async () => {
  try {
    const result = await chrome.storage.local.get(["useMock", "mockType"]);
    const mockToggle = document.getElementById("mockToggle");
    const mockType = document.getElementById("mockType");

    if (result.useMock !== undefined) mockToggle.checked = result.useMock;
    if (result.mockType) mockType.value = result.mockType;

    document.getElementById("mockSelector").style.display = mockToggle.checked
      ? "block"
      : "none";

    // Show/hide refresh button until fields are filled
    document.getElementById("refreshBtn").style.display = "none";
  } catch (error) {
    console.error("Error loading settings:", error);
  }
});

document.getElementById("mockToggle").addEventListener("change", async (e) => {
  const isMock = e.target.checked;
  document.getElementById("mockSelector").style.display = isMock
    ? "block"
    : "none";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      await chrome.tabs.sendMessage(tab.id, {
        action: "updateConfig",
        config: { USE_MOCK: isMock },
      });
    }
    await chrome.storage.local.set({ useMock: isMock });
  } catch (error) {
    console.error("Error updating config:", error);
  }
});

document.getElementById("mockType").addEventListener("change", async (e) => {
  const mockType = e.target.value;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      await chrome.tabs.sendMessage(tab.id, {
        action: "updateConfig",
        config: { MOCK_TYPE: mockType },
      });
    }
    await chrome.storage.local.set({ mockType });
  } catch (error) {
    console.error("Error saving mock type:", error);
  }
});

document.getElementById("scanFillBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Scanning...";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      statusEl.textContent = "No active tab found";
      return;
    }

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch (err) {
      // Script might already be injected
      console.error("Script injection error:", err);
    }

    const { mockType = "default" } = await chrome.storage.local.get("mockType");

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "scanForm",
      mockType: mockType,
    });

    statusEl.textContent = `Filled ${response.filled} fields`;

    setTimeout(() => {
      statusEl.textContent = "";
      document.getElementById("refreshBtn").style.display = "block"
    }, 2000);
  } catch (error) {
    console.error("Error:", error);
    statusEl.textContent = "Error: " + error.message;
  }
});

document.getElementById("refreshBtn").addEventListener("click", async () => {
  const refreshIcon = document.getElementById("refreshIcon");

  refreshIcon.classList.add("spinning");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    await chrome.tabs.sendMessage(tab.id, {
      action: "refreshFields",
    });
  } catch (error) {
    console.error("Error refreshing:", error);
  } finally {
    setTimeout(() => {
      refreshIcon.classList.remove("spinning");
    }, 1000);
  }
});
