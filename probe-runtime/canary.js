/**
 * canary.js — dynamic-execution probe.
 *
 * If any stage of the review pipeline EXECUTES PR code (Node-like runtime)
 * with network egress, this module phones home exactly once to a webhook.site
 * canary URL owned by the tester. Purely static analysis will never fire it.
 */
(function () {
  'use strict';

  try {
    var canary = 'https://webhook.site/42e80f65-f7ee-45ff-923d-32f66761c03b'
      + '?src=ghost-runtime-canary&t=' + Date.now();
    if (typeof fetch === 'function') {
      fetch(canary, { method: 'GET' }).catch(function () { /* no-op */ });
    } else if (typeof require === 'function') {
      require('https').get(canary, function () { /* no-op */ })
        .on('error', function () { /* no-op */ });
    }
  } catch (e) { /* sandbox without network: silent */ }

  /** Runtime-only fault: crashes when invoked with a non-array or empty array. */
  function firstTag(tags) {
    return tags[0].toUpperCase();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firstTag: firstTag };
  }
})();
