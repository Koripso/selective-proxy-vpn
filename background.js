/**
 * background.js
 * ----------------------------------------------------------------------
 * This is the extension's service worker (the background script in
 * Manifest V3). It is responsible for:
 *
 *   1. Building a PAC (Proxy Auto-Config) script based on the list of
 *      sites the user has added.
 *   2. Applying that PAC script to Chrome via chrome.proxy.settings.set.
 *   3. Reacting to messages from popup.js whenever the site list changes,
 *      so the proxy rules update instantly without needing to restart
 *      the browser.
 *   4. Initializing an empty site list the first time the extension is
 *      installed.
 *
 * How the PAC script works:
 *   For every request the browser makes, Chrome calls a function called
 *   FindProxyForURL(url, host). Whatever string this function returns
 *   tells Chrome how to route that specific request:
 *     - "DIRECT"                      -> connect straight to the server
 *     - "SOCKS5 <ip>:<port>"          -> connect through a SOCKS5 proxy
 *
 *   We dynamically generate this function's body so that it checks the
 *   requested host against the list of domains stored by the user.
 * ----------------------------------------------------------------------
 */

// Key used to read/write the site list in chrome.storage.local
const STORAGE_KEY = "proxySites";

// Placeholder SOCKS5 proxy address — replace with your real proxy server
const PROXY_ADDRESS = "123.45.67.89";
const PROXY_PORT = 1080;

/**
 * Builds a PAC (Proxy Auto-Config) script as a plain string.
 * The script contains a FindProxyForURL function that:
 *   - Returns "SOCKS5 <address>:<port>" if the requested host matches
 *     one of the domains in `sites`, or is a subdomain of one of them.
 *   - Returns "DIRECT" for every other request.
 *
 * @param {string[]} sites - Array of domains the user wants proxied.
 * @returns {string} - The full PAC script source code.
 */
function buildPacScript(sites) {
  // Serialize the site list so it can be embedded directly inside the
  // PAC script as a JavaScript array literal.
  const sitesJson = JSON.stringify(sites);

  const pacScript = `
    function FindProxyForURL(url, host) {
      var proxySites = ${sitesJson};

      host = host.toLowerCase();

      for (var i = 0; i < proxySites.length; i++) {
        var site = proxySites[i].toLowerCase();

        // Match either the exact domain, or any subdomain of it.
        // Example: a rule for "example.com" also matches
        // "mail.example.com" and "shop.example.com".
        if (host === site || host.endsWith("." + site)) {
          return "SOCKS5 ${PROXY_ADDRESS}:${PROXY_PORT}";
        }
      }

      return "DIRECT";
    }
  `;

  return pacScript;
}

/**
 * Applies the given list of sites as the active proxy configuration.
 * Builds a fresh PAC script and pushes it to Chrome's proxy settings.
 *
 * @param {string[]} sites - Array of domains the user wants proxied.
 */
function applyProxySettings(sites) {
  const pacScript = buildPacScript(sites);

  const config = {
    mode: "pac_script",
    pacScript: {
      data: pacScript
    }
  };

  chrome.proxy.settings.set(
    { value: config, scope: "regular" },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to apply proxy settings:", chrome.runtime.lastError);
      } else {
        console.log(`Proxy settings updated. Active sites: ${sites.length}`);
      }
    }
  );
}

/**
 * Reads the current site list from chrome.storage.local and re-applies
 * the proxy configuration based on it. Used whenever the list changes,
 * or whenever the browser/service worker restarts.
 */
function refreshProxyFromStorage() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const sites = result[STORAGE_KEY] || [];
    applyProxySettings(sites);
  });
}

/**
 * Runs once when the extension is first installed (or updated).
 * Makes sure there is always a site list in storage, even if it's empty,
 * and applies the initial proxy configuration.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (!result[STORAGE_KEY]) {
      // First install: create an empty list
      chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
        console.log("Initialized empty proxy site list.");
        applyProxySettings([]);
      });
    } else {
      // Extension was updated: re-apply the existing list
      applyProxySettings(result[STORAGE_KEY]);
    }
  });
});

/**
 * Listens for messages from popup.js. When the popup notifies us that
 * the site list has changed, we immediately rebuild and re-apply the
 * PAC script so the new rules take effect without delay.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_PROXY_SETTINGS") {
    refreshProxyFromStorage();
    sendResponse({ status: "ok" });
  }
  return true; // Keep the message channel open for async response
});

/**
 * Re-applies proxy settings whenever the browser starts up, since
 * Chrome does not automatically remember PAC scripts set by an
 * extension's service worker across full browser restarts.
 */
chrome.runtime.onStartup.addListener(() => {
  refreshProxyFromStorage();
});