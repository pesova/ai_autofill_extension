document.getElementById("fillBtn").addEventListener("click", async () => {
    try {
      // Load user details
      const res = await fetch(chrome.runtime.getURL("userData.json"));
      const data = await res.json();
  
      // Send to active tab
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: "fillForm", data });
    } catch (err) {
      console.error("Error loading user data:", err);
    }
  });
  