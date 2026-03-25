// Apply theme immediately
if (localStorage.getItem("darkMode") === "enabled") {
  document.body.classList.add("dark");
}

// Toggle
function toggleDarkMode() {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "darkMode",
    document.body.classList.contains("dark") ? "enabled" : "disabled"
  );
}