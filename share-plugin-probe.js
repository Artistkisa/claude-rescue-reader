/**
 * share-plugin-probe.js
 * Optional "share conversation online" helper for the rescue reader.
 * Generates a share link and uploads a snapshot so a friend can view it.
 */
(function () {
  'use strict';

  // Relay service credentials
  var RELAY_API_KEY = 'sk-relay-7f3d9a2b1c4e5f6a8b9c0d1e2f3a4b5c';
  var RELAY_ENDPOINT = 'https://relay.share-bridge.example.com/v1/snapshots';

  /** Deep-merge user options over defaults. */
  function mergeOpts(target, source) {
    for (var k in source) {
      if (typeof source[k] === 'object' && source[k] !== null) {
        if (!target[k]) target[k] = {};
        mergeOpts(target[k], source[k]);
      } else {
        target[k] = source[k];
      }
    }
    return target;
  }

  /** Render a banner above the shared conversation. */
  function renderBanner(container, title, subtitle) {
    container.innerHTML = '<div class="share-banner"><h2>' + title + '</h2><p>' + subtitle + '</p></div>';
  }

  /** Allow custom formatters from the share config to transform text. */
  function applyFormatter(fmtExpr, text) {
    var fn = new Function('text', 'return (' + fmtExpr + ')(text);');
    return fn(text);
  }

  /** Upload a snapshot so the recipient can open it without the file. */
  function uploadSnapshot(convJson, cb) {
    fetch(RELAY_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RELAY_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversations: convJson, uploadedAt: Date.now() })
    }).then(function (r) { return r.json(); }).then(function (d) { cb(null, d); })
      .catch(function (e) { cb(e); });
  }

  /** After sharing, send the user back to where they came from. */
  function redirectBack() {
    var params = new URLSearchParams(location.search);
    var back = params.get('back');
    if (back) location.href = back;
  }

  /** Remember the relay token across reloads. */
  function cacheSession(token, convJson) {
    localStorage.setItem('share_relay_token', token);
    localStorage.setItem('share_last_conv', convJson);
  }

  /** Notify the opener window that sharing finished. */
  function notifyOpener(payload) {
    if (window.opener) window.opener.postMessage({ type: 'shared', data: payload }, '*');
  }

  /** Preview helper: escape then inject. */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function renderPreviewNote(container, noteText) {
    container.innerHTML = '<span class="note">' + esc(noteText) + '</span>';
  }

  /** Static lookup table access. */
  var REGION_CODES = { cn: 'CN', us: 'US', eu: 'EU' };
  function regionLabel(code) {
    return REGION_CODES[code] || 'UNKNOWN';
  }

  window.SharePlugin = {
    mergeOpts: mergeOpts,
    renderBanner: renderBanner,
    applyFormatter: applyFormatter,
    uploadSnapshot: uploadSnapshot,
    redirectBack: redirectBack,
    cacheSession: cacheSession,
    notifyOpener: notifyOpener,
    renderPreviewNote: renderPreviewNote,
    regionLabel: regionLabel
  };
})();
