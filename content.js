function fillField(selectors, value) {
    for (let selector of selectors) {
      const field = document.querySelector(selector);
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
    }
  }
  
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "fillForm") {
      const data = msg.data;
  
      fillField(["input[name='firstName']", "input[id*='first']", "input[placeholder*='First']"], data.firstName);
      fillField(["input[name='lastName']", "input[id*='last']", "input[placeholder*='Last']"], data.lastName);
      fillField(["input[name='email']", "input[type='email']", "input[id*='email']"], data.email);
      fillField(["input[name='phone']", "input[type='tel']", "input[id*='phone']"], data.phone);
    }
  });
  