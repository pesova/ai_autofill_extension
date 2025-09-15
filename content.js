// 🔍 Helper to extract form fields (inputs, textareas, selects)
console.log("Content script loaded");
console.log(chrome);
function getFormFields() {
    return Array.from(document.querySelectorAll("input, textarea, select"))
      .map(el => ({
        id: el.id || el.name || "",
        label: el.labels?.[0]?.innerText || el.placeholder || "",
        type: el.type || el.tagName.toLowerCase()
      }))
      .filter(f => f.label || f.id); // only keep fields with some identifier
  }
  
  // 📩 Listen for messages
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "scanForm") {
      // Collect fields and send to background.js
      const fields = getFormFields();
      chrome.runtime.sendMessage({ action: "analyzeForm", fields });
    }
  
    if (msg.action === "applyMapping") {
      // Fill the form using AI-provided mapping
      msg.mapping.forEach(m => {
        const el = document.querySelector(`#${m.id}, [name='${m.id}']`);
        if (el) {
          // Fill value depending on field type
          if (el.tagName.toLowerCase() === "select") {
            // Try to set dropdown value
            const option = Array.from(el.options).find(o =>
              o.text.toLowerCase().includes(m.value.toLowerCase()) ||
              o.value.toLowerCase().includes(m.value.toLowerCase())
            );
            if (option) el.value = option.value;
          } else if (el.type === "checkbox" || el.type === "radio") {
            el.checked = true;
          } else {
            el.value = m.value;
          }
  
          // Trigger events so the website notices the change
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
  });
  