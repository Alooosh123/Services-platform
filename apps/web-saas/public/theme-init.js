(function () {
  var theme = 'light';
  try {
    var saved = localStorage.getItem('asaas-theme');
    if (saved === 'dark') theme = 'dark';
  } catch (error) {
    // Use the light theme when browser storage is unavailable.
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
