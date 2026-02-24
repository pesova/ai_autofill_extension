(function () {
  console.log("content.js loaded - Form Autofill Extension");

  // Store original values and filled fields
  let filledFields = new Map();
  let CONFIG = {
    USE_MOCK: true,
    MOCK_TYPE: "default",
    OPENAI_API_KEY: "",
  };

  // Check if already initialized
  if (window.__formAutofillInitialized) {
    console.log("Content script already initialized, skipping...");
    return;
  }
  window.__formAutofillInitialized = true;

  // Initialize by loading config
  (async function init() {
    await loadConfig();
    await loadMocks();
  })();

  async function loadConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL("config.json"));
      const fileConfig = await response.json();
      CONFIG = { ...CONFIG, ...fileConfig };

      // Load user preferences from storage
      if (chrome.storage?.local) {
        const result = await chrome.storage.local.get(["useMock", "mockType"]);
        if (result.useMock !== undefined) CONFIG.USE_MOCK = result.useMock;
        if (result.mockType) CONFIG.MOCK_TYPE = result.mockType;
      }

      console.log("Config loaded:", CONFIG);
    } catch (error) {
      console.error("Error loading config:", error);
    }
  }

  async function loadProfile() {
    try {
      const res = await fetch(chrome.runtime.getURL("userData.json"));
      return res.json();
    } catch (error) {
      console.error("Error loading profile:", error);
      return {};
    }
  }

  async function loadMocks() {
    try {
      const response = await fetch(chrome.runtime.getURL("mocks.json"));
      window.MOCK_MAPPINGS = await response.json();
      console.log("Mocks loaded:", window.MOCK_MAPPINGS);
    } catch (error) {
      console.error("Error loading mocks:", error);
    }
  }

  // Get unique selector for an element
  function getUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.name) return `[name="${el.name}"]`;
    // Build a simple path
    let path = [];
    while (el?.nodeType === Node.ELEMENT_NODE) {
      let selector = el.tagName.toLowerCase();
      if (el.className) {
        selector += "." + el.className.split(" ").join(".");
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(" > ");
  }

  // Get form fields
  function getFormFields() {
    return Array.from(document.querySelectorAll("input, textarea, select"))
      .map((el) => ({
        id: el.id || el.name || "",
        label: el.labels?.[0]?.innerText || el.placeholder || "",
        type: el.type || el.tagName.toLowerCase(),
        value: el.value,
        selector: getUniqueSelector(el),
      }))
      .filter((f) => f.label || f.id);
  }

  // Store original value before filling
  function storeOriginalValue(el) {
    if (!filledFields.has(el)) {
      filledFields.set(el, {
        originalValue: el.value,
        originalChecked: el.checked,
      });
    }
  }

  // Analyze form and get mapping
  async function analyzeForm(fields) {
    try {
      const profile = await loadProfile();

      if (CONFIG.USE_MOCK) {
        // Use mock data
        const mockType = CONFIG.MOCK_TYPE || "default";
        let mockMapping =
          window.MOCK_MAPPINGS[mockType] || window.MOCK_MAPPINGS.default;
        console.log(`Using MOCK mapping (${mockType}):`, mockMapping);
        return mockMapping;
      }

      // Real API call
      const prompt = `
You are a job form autofill assistant.
Match the form fields to the correct values from this profile:

Profile: ${JSON.stringify(profile, null, 2)}
Form fields: ${JSON.stringify(fields, null, 2)}

Return ONLY a JSON array like:
[
  { "id": "<field id>", "value": "<filled value>" }
]
    `;

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
          }),
        },
      );

      const data = await response.json();
      console.log("AI mapping:", data.choices[0].message.content);

      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error("Error in analyzeForm:", error);
      return [];
    }
  }

  // Apply mapping to form fields
  function applyMapping(mapping) {
    let filledCount = 0;

    mapping.forEach((m) => {
      // Try different selectors

      const el =
        document.querySelector(`#${m.id}`) ||
        document.querySelector(`[name='${m.id}']`) ||
        document.querySelector(`[name='${m.id.toLowerCase()}']`) ||
        document.querySelector(`[placeholder='${m.id}']`) ||
        document.querySelector(`[id*='${m.id}']`) ||
        document.querySelector(`[name*='${m.id}']`);

      if (el) {
        // Store original value before filling
        storeOriginalValue(el);

        console.log(`Filling field ${m.id} with value:`, m.value);

        // Fill value depending on field type
        if (el.tagName.toLowerCase() === "select") {
          const option = Array.from(el.options).find(
            (o) =>
              o.text.toLowerCase().includes(m.value.toLowerCase()) ||
              o.value.toLowerCase().includes(m.value.toLowerCase()),
          );
          if (option) el.value = option.value;
        } else if (el.type === "checkbox" || el.type === "radio") {
          el.checked = true;
        } else {
          el.value = m.value;
        }

        // Trigger events
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));

        filledCount++;
      } else {
        console.log(`Field not found: ${m.id}`);
      }
    });

    return filledCount;
  }

function refreshFields() {
  let refreshedCount = 0;
  
  filledFields.forEach((data, el) => {
    try {
      // Check if element still exists in DOM
      if (document.body.contains(el)) {
        console.log(`Refreshing field to original value:`, data.originalValue);
        
        if (el.tagName.toLowerCase() === 'select') {
          const originalOption = Array.from(el.options).find(opt => opt.value === data.originalValue);
          if (originalOption) el.value = data.originalValue;
        } else if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = data.originalChecked;
        } else {
          el.value = data.originalValue;
        }
        
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        
        refreshedCount++;
      } else {
        // Element no longer exists, remove from map
        filledFields.delete(el);
      }
    } catch (error) {
      console.error(`Error refreshing field:`, error);
    }
  });  
  return refreshedCount;
}

  // Listen for messages from popup ONLY
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("Content script received message:", msg);

    if (msg.action === "scanForm") {
      // Handle scan form
      (async () => {
        try {
          const fields = getFormFields();
          console.log("Found fields:", fields);

          const mapping = await analyzeForm(fields);
          const filledCount = applyMapping(mapping);

          sendResponse({
            status: "ok",
            fieldsFound: fields.length,
            filled: filledCount,
          });
        } catch (error) {
          console.error("Error in scanForm:", error);
          sendResponse({ status: "error", error: error.message });
        }
      })();
      return true; // Keep channel open for async response
    }

    if (msg.action === "refreshFields") {
      try {
        const refreshedCount = refreshFields();
        sendResponse({
          success: true,
          refreshedCount: refreshedCount,
        });
      } catch (error) {
        console.error("Error refreshing fields:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    if (msg.action === "getFilledFields") {
      sendResponse({
        hasFilledFields: filledFields.size > 0,
        count: filledFields.size,
      });
      return true;
    }

    if (msg.action === "updateConfig") {
      // Update config from popup
      if (msg.config.USE_MOCK !== undefined) {
        CONFIG.USE_MOCK = msg.config.USE_MOCK;
      }
      if (msg.config.MOCK_TYPE !== undefined) {
        CONFIG.MOCK_TYPE = msg.config.MOCK_TYPE;
      }
      console.log("Config updated:", CONFIG);
      sendResponse({ success: true });
      return true;
    }
  });

  console.log("Content script ready - listening for messages");
})();
