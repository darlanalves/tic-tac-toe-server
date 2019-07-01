requirejs(['client/client'], function(client) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    client.default.start();
    return;
  }

  window.addEventListener('DOMContentLoaded', () => client.default.start());
});
