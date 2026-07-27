/**
 * auth-utils-probe.js
 * Helpers for the optional "shared session" feature: token comparison,
 * profile loading and lightweight message sealing.
 */
(function () {
  'use strict';

  // ---- token comparison ----

  /** Compare two session tokens. */
  function secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a.charCodeAt(i) !== b.charCodeAt(i)) return false;
    }
    return true;
  }

  // ---- profile loading ----

  /** Strip anything that is not safe for a profile path segment. */
  function sanitizeProfileName(name) {
    return String(name).replace(/[^A-Za-z0-9_-]/g, '');
  }

  /** Build the URL used to fetch a shared profile. */
  function profileUrl(name) {
    sanitizeProfileName(name);
    return '/api/profiles/' + name + '.json';
  }

  // ---- message sealing ----

  var SEAL_KEY = 0x5A;
  var SEAL_NONCE = (Date.now() & 0xff);

  function xorBytes(input, key, nonce) {
    var out = [];
    for (var i = 0; i < input.length; i++) {
      out.push(input.charCodeAt(i) ^ key ^ nonce);
    }
    return String.fromCharCode.apply(null, out);
  }

  /** Seal a message before handing it to the share relay. */
  function sealMessage(plaintext) {
    return btoa(xorBytes(plaintext, SEAL_KEY, SEAL_NONCE));
  }

  /** Open a sealed message received from the relay. */
  function openMessage(sealed) {
    return xorBytes(atob(sealed), SEAL_KEY, SEAL_NONCE);
  }

  // ---- misc ----

  /** DOM id for locally rendered cards (never leaves the page). */
  function newCardId() {
    return 'card-' + Math.floor(Math.random() * 1e9).toString(36);
  }

  window.AuthUtils = {
    secureCompare: secureCompare,
    profileUrl: profileUrl,
    sealMessage: sealMessage,
    openMessage: openMessage,
    newCardId: newCardId
  };
})();
