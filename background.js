/**
 * background.js
 * ----------------------------------------------------------------------
 * This is the extension's service worker (the background script in
 * Manifest V3). It is responsible for:
 *
 *   1. Building a PAC (Proxy Auto-Config) script based on the list of
 *      sites the user has added, and the proxy server address/port the
 *      user has configured.
 *   2. Applying that PAC script to Chrome via chrome.proxy.settings.set.
 *   3. Reacting to messages from popup.js whenever the site list or the
 *      proxy server settings change, so the rules update instantly
 *      without needing to restart the browser.
 *   4. Initializing default values the first time the extension is
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

// Storage keys — must match the ones used in popup.js
const SITES_KEY = "proxySites";
const PROXY_CONFIG_KEY = "proxyConfig";

// Fallback values used only if the user hasn't configured a proxy yet
const DEFAULT_PROXY_ADDRESS = "127.0.0.1";
const DEFAULT_PROXY_PORT = 1080;

/**
 * Builds a PAC (Proxy Auto-Config) script as a plain string.
 * The script contains a FindProxyForURL function that:
 *   - Returns "SOCKS5 <address>:<port>" if the requested host matches
 *     one of the domains in `sites`, or is a subdomain of one of them.
 *   - Returns "DIRECT" for every other request.
 *
 * FIXED: Now properly escapes special characters in site names to prevent
 * PAC script injection attacks.
 *
 * @param {string[]} sites - Array of domains the user wants proxied.
 * @param {{address: string, port: number}} proxyConfig - Proxy server
 *        address and port to route matched traffic through.
 * @returns {string} - The full PAC script source code.
 */
function buildPacScript(sites, proxyConfig) {
  // Sanitize sites to prevent injection: escape backslashes and quotes
  const sanitizedSites = sites.map(site => {
    return site
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
  });
  
  const sitesJson = JSON.stringify(sanitizedSites);
  const proxyAddress = proxyConfig.address;
  const proxyPort = proxyConfig.port;

  const pacScript = `
    function FindProxyForURL(url, host) {
      var proxySites = ${sitesJson};

      host = host.toLowerCase();

      for (var i = 0; i < proxySites.length; i++) {
        var site = proxySites[i].toLowerCase();

        // Match either the exact domain/IP, or any subdomain of it.
        // Example: a rule for "example.com" also matches
        // "mail.example.com" and "shop.example.com".
        // IP addresses and "localhost" are matched by exact string only,
        // since they don't have subdomains.
        if (host === site || host.endsWith("." + site)) {
          return "SOCKS5 ${proxyAddress}:${proxyPort}";
        }
      }

      return "DIRECT";
    }
  `;

  return pacScript;
}

/**
 * Applies the given list of sites and proxy configuration as the active
 * proxy configuration. Builds a fresh PAC script and pushes it to
 * Chrome's proxy settings.
 *
 * @param {string[]} sites - Array of domains the user wants proxied.
 * @param {{address: string, port: number}} proxyConfig - Proxy server
 *        address and port.
 * @returns {Promise<void>} - Resolves once settings have been applied,
 *        rejects if Chrome reports an error.
 */
function applyProxySettings(sites, proxyConfig) {
  return new Promise((resolve, reject) => {
    const pacScript = buildPacScript(sites, proxyConfig);

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
          reject(chrome.runtime.lastError);
        } else {
          console.log(`Proxy settings updated. Active sites: ${sites.length}, proxy: ${proxyConfig.address}:${proxyConfig.port}`);
          resolve();
        }
      }
    );
  });
}

/**
 * Reads the current site list and proxy configuration from
 * chrome.storage.local and re-applies the proxy settings based on them.
 * Used whenever either value changes, or whenever the browser/service
 * worker restarts.
 *
 * @returns {Promise<void>}
 */
function refreshProxyFromStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([SITES_KEY, PROXY_CONFIG_KEY], (result) => {
      const sites = result[SITES_KEY] || [];
      const proxyConfig = result[PROXY_CONFIG_KEY] || {
        address: DEFAULT_PROXY_ADDRESS,
        port: DEFAULT_PROXY_PORT
      };

      applyProxySettings(sites, proxyConfig)
        .then(resolve)
        .catch(reject);
    });
  });
}

/**
 * Runs once when the extension is first installed (or updated).
 * Makes sure there is always a site list and a proxy configuration in
 * storage, even if they're just default/empty values, and applies the
 * initial proxy configuration.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([SITES_KEY, PROXY_CONFIG_KEY], (result) => {
    const updates = {};

    if (!result[SITES_KEY]) {
      updates[SITES_KEY] = [];
    }

    if (!result[PROXY_CONFIG_KEY]) {
      updates[PROXY_CONFIG_KEY] = {
        address: DEFAULT_PROXY_ADDRESS,
        port: DEFAULT_PROXY_PORT
      };
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        console.log("Initialized default proxy site list / proxy configuration.");
        refreshProxyFromStorage();
      });
    } else {
      // Extension was updated: re-apply the existing configuration
      refreshProxyFromStorage();
    }
  });
});

/**
 * Listens for messages from popup.js. When the popup notifies us that
 * the site list or the proxy configuration has changed, we immediately
 * rebuild and re-apply the PAC script so the new rules take effect
 * without delay. Responds with a status object so the popup can show
 * success/error feedback to the user.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_PROXY_SETTINGS") {
    refreshProxyFromStorage()
      .then(() => sendResponse({ status: "ok" }))
      .catch((error) => sendResponse({ status: "error", error: String(error) }));

    return true; // Keep the message channel open for the async response
  }
});

/**
 * Re-applies proxy settings whenever the browser starts up, since
 * Chrome does not automatically remember PAC scripts set by an
 * extension's service worker across full browser restarts.
 */
chrome.runtime.onStartup.addListener(() => {
  refreshProxyFromStorage();
});
