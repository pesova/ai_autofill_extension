console.log("popup.js loaded ");

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("scanFillBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      console.log("Scan & Fill button clicked ✅");
    });
  } else {
    console.error("❌ Button not found");
  }
});