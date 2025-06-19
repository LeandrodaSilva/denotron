export const injected = `
window.onload = async () => {
  const widget = document.createElement('div');
  widget.style.position = 'fixed';
  widget.style.bottom = '10px';
  widget.style.right = '10px';
  widget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  widget.style.color = 'white';
  widget.style.padding = '10px';
  widget.style.borderRadius = '5px';
  widget.style.zIndex = '1000';
  widget.innerHTML = 'Denotron Widget Loaded!';
  document.body.appendChild(widget);
  
  document.addEventListener('mousemove', (event) => {
    const x = event.clientX;
    const y = event.clientY;
    widget.innerHTML = 'Mouse em: ' + x + ', ' + y;
  });
  
  denotronLog("Ready to use Denotron!");
  
  window.receiveMessage = (commands) => {
    denotronLog("Received commands", commands);
    commands.forEach((command) => {
      try {
        denotronLog("Executing command:", command.command);
        switch (command.command) {
          case "click":
            window.denotronClick(...command.args);
            break;
          case "fill":
            window.denotronFill(...command.args);
            break;
          case "see":
            window.denotronSee(...command.args);
            break;
          default:
            denotronLog("Unknown command:", command.command);
        }
      } catch (error) {
        denotronLog("Error executing command:", error.message);
      }
    });
  }
  
  setTimeout(() => {
    denotronLoaded();
  }, 3000);
}

window.denotronClick = (selector) => {
 const element = document.querySelector(selector);
 if (element) {
  element.focus();
  denotronLog("Clicking element:", element?.name || element.id || element.tagName);
  element.click();
 }
}

window.denotronFill = (selector, text) => {
  const element = document.querySelector(selector);
  const delay = 100;
  if (element) {
    denotronLog("Filling element:", element?.name || element.id || element.tagName, "with text:", text);
    element.focus();
    element.value = ""; // Limpa o campo
    for (const char of text) {
      const start = element.selectionStart;
      element.setRangeText(char, start, start, "end");
      element.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

window.denotronSee = (selector) => {
  while(true) {
    denotronLog("Checking for element:", selector);
    const element = document.querySelector(selector);
    if (element) {
      denotronLog("Seeing element:", element?.name || element.id || element.tagName);
      resolve(element.innerHTML || element.textContent);
      break;
    } else {
      denotronLog("Element not found:", selector);
      reject("not found");
      break;
    }
    
    const start = Date.now();
    while (Date.now() - start < 5000) {
      // Espera 5 segundos antes de tentar novamente
    }
  }
}
`

export default injected;
