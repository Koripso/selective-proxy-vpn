/**
 * popup.js
 * ----------------------------------------------------------------------
 * Handles all UI logic inside the extension's popup window:
 *
 *   1. Loads the current site list and proxy server configuration from
 *      chrome.storage.local and renders them as soon as the popup opens.
 *   2. Validates and normalizes user input when adding a new domain
 *      (strips protocol, "www.", path, port, etc.), while also allowing
 *      "localhost" and plain IPv4 addresses.
 *   3. Validates the proxy server address/port fields.
 *   4. Saves updates back to chrome.storage.local.
 *   5. Notifies background.js whenever the site list or proxy config
 *      changes, so it can rebuild the PAC script and apply it
 *      immediately, and shows the result (success/error) to the user.
 *   6. Removes sites from the list when the user clicks the remove (✕)
 *      button next to an entry.
 * ----------------------------------------------------------------------
 */

// Storage keys — must match the ones used in background.js
const SITES_KEY = "proxySites";
const PROXY_CONFIG_KEY = "proxyConfig";

// Fallback values shown/used if nothing has been configured yet
const DEFAULT_PROXY_ADDRESS = "127.0.0.1";
const DEFAULT_PROXY_PORT = 1080;

// Cache references to the DOM elements we'll be working with
const domainInput = document.getElementById("domain-input");
const addBtn = document.getElementById("add-btn");
const errorMsg = document.getElementById("error-msg");
const statusMsg = document.getElementById("status-msg");
const siteList = document.getElementById("site-list");
const proxyAddressInput = document.getElementById("proxy-address-input");
const proxyPortInput = document.getElementById("proxy-port-input");
const saveProxyBtn = document.getElementById("save-proxy-btn");

/**
 * Cleans up whatever the user typed into the domain input field and
 * extracts a plain domain (or IP address, or "localhost") from it.
 *
 * Examples:
 *   "https://www.example.com/path?x=1"  -> "example.com"
 *   "WWW.Example.com"                   -> "example.com"
 *   "example.com:8080"                  -> "example.com"
 *   "http://localhost:3000"             -> "localhost"
 *   "http://192.168.1.10/"              -> "192.168.1.10"
 *
 * @param {string} raw - The raw text typed by the user.
 * @returns {string} - A normalized, lowercase host with no protocol,
 *                      "www." prefix, path, query string, or port.
 */
function normalizeDomain(raw) {
  let value = raw.trim().toLowerCase();

  if (!value) {
    return "";
  }

  // Remove protocol (http:// or https://)
  value = value.replace(/^https?:\/\//, "");

  // Remove leading "www."
  value = value.replace(/^www\./, "");

  // Remove any path or query string
  value = value.split("/")[0];
  value = value.split("?")[0];

  // Remove port, but only if it's not part of an IPv6 address (we don't
  // support IPv6 here, so this simple split is safe for our use case)
  value = value.split(":")[0];

  return value;
}

/**
 * Checks whether a string is a valid IPv4 address, e.g. "192.168.1.10".
 *
 * @param {string} value - The string to check.
 * @returns {boolean}
 */
function isValidIPv4(value) {
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = value.match(ipv4Pattern);

  if (!match) {
    return false;
  }

  // Each octet must be between 0 and 255
  return match.slice(1).every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
}

/**
 * Performs a lightweight validation check to confirm that a string
 * looks like a real, usable host: a domain name (e.g. "example.com"),
 * an IPv4 address (e.g. "192.168.1.10"), or "localhost".
 * This is not a full RFC-compliant validator, but it's enough to catch
 * obvious typos and prevent garbage entries.
 *
 * FIXED: Now properly validates single-label domains (not just multi-label)
 * and handles edge cases with hyphens.
 *
 * @param {string} host - The normalized host to validate.
 * @returns {boolean} - True if the host looks valid.
 */
function isValidHost(host) {
  if (host === "localhost") {
    return true;
  }

  if (isValidIPv4(host)) {
    return true;
  }

  // Updated pattern: allows single-label domains like "myhost" and multi-label like "example.com"
  // Labels cannot start or end with hyphen, and can be 1-63 chars
  const domainPattern = /^(?!-)([a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63}(?<!-))*)?$/;
  return domainPattern.test(host) && host.length > 0;
}

/**
 * Validates a proxy port value.
 *
 * @param {string} value - The raw port value typed by the user.
 * @returns {boolean} - True if it's a valid TCP port number (1-65535).
 */
function isValidPort(value) {
  if (!/^\d+$/.test(value)) {
    return false;
  }

  const port = Number(value);
  return port >= 1 && port <= 65535;
}

/**
 * Shows a temporary success message under the site input row.
 * Automatically fades out after a short delay.
 * FIXED: Now properly clears the timeout to prevent multiple messages stacking.
 *
 * @param {string} text - The message to display.
 */
let statusTimeoutId = null;
function showStatusMessage(text) {
  // Clear any pending timeout to prevent stacking
  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
  }
  
  statusMsg.textContent = text;
  statusMsg.classList.add("visible");

  statusTimeoutId = setTimeout(() => {
    statusMsg.classList.remove("visible");
    statusTimeoutId = null;
  }, 2000);
}

/**
 * Loads the current site list and proxy configuration from
 * chrome.storage.local and renders them in the popup. Called once when
 * the popup is opened.
 */
function loadState() {
  chrome.storage.local.get([SITES_KEY, PROXY_CONFIG_KEY], (result) => {
    const sites = result[SITES_KEY] || [];
    const proxyConfig = result[PROXY_CONFIG_KEY] || {
      address: DEFAULT_PROXY_ADDRESS,
      port: DEFAULT_PROXY_PORT
    };

    renderSiteList(sites);
    proxyAddressInput.value = proxyConfig.address;
    proxyPortInput.value = proxyConfig.port;
  });
}

/**
 * Renders the given array of sites as a list of items in the popup UI.
 * Each item shows the domain/IP name and a remove ("✕") button.
 * If the list is empty, shows a friendly placeholder message instead.
 *
 * @param {string[]} sites - Array of hosts to display.
 */
function renderSiteList(sites) {
  siteList.innerHTML = "";

  if (sites.length === 0) {
    const emptyMsg = document.createElement("li");
    emptyMsg.className = "empty-msg";
    emptyMsg.textContent = "No sites added yet.";
    siteList.appendChild(emptyMsg);
    return;
  }

  sites.forEach((site) => {
    const item = document.createElement("li");
    item.className = "site-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "site-name";
    nameSpan.textContent = site;
    nameSpan.title = site; // Full host shown on hover if truncated

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => removeSite(site));

    item.appendChild(nameSpan);
    item.appendChild(removeBtn);
    siteList.appendChild(item);
  });
}

/**
 * Sends a message to background.js telling it that either the site list
 * or the proxy configuration has changed, so it can rebuild the PAC
 * script and re-apply proxy settings immediately. Shows a success or
 * error message to the user based on the response.
 * FIXED: Now handles missing response object safely.
 */
function notifyBackgroundToUpdateProxy() {
  chrome.runtime.sendMessage({ type: "UPDATE_PROXY_SETTINGS" }, (response) => {
    // Guard against cases where response is undefined
    if (response && response.status === "ok") {
      showStatusMessage("✓ Proxy settings applied");
    } else {
      const errorText = response?.error || "Unknown error";
      errorMsg.textContent = `Failed to apply proxy settings: ${errorText}. Check the service worker console.`;
    }
  });
}

/**
 * Saves the given site list to chrome.storage.local, re-renders the UI,
 * and notifies background.js so it can rebuild and apply the PAC script.
 *
 * @param {string[]} sites - The full, updated array of hosts.
 */
function saveSites(sites) {
  chrome.storage.local.set({ [SITES_KEY]: sites }, () => {
    renderSiteList(sites);
    notifyBackgroundToUpdateProxy();
  });
}

/**
 * Handles the "Add" button click: validates the typed host, checks for
 * duplicates, and if everything looks good, adds it to the list and
 * saves it.
 */
function addSite() {
  errorMsg.textContent = "";

  const rawValue = domainInput.value;
  const host = normalizeDomain(rawValue);

  if (!host) {
    errorMsg.textContent = "Please enter a domain, IP address, or \"localhost\".";
    return;
  }

  if (!isValidHost(host)) {
    errorMsg.textContent = "Invalid domain or IP address format.";
    return;
  }

  chrome.storage.local.get([SITES_KEY], (result) => {
    const sites = result[SITES_KEY] || [];

    if (sites.includes(host)) {
      errorMsg.textContent = "This site is already in the list.";
      return;
    }

    sites.push(host);
    saveSites(sites);
    domainInput.value = "";
  });
}

/**
 * Removes a host from the site list and saves the updated list.
 *
 * @param {string} hostToRemove - The host to remove.
 */
function removeSite(hostToRemove) {
  chrome.storage.local.get([SITES_KEY], (result) => {
    const sites = result[SITES_KEY] || [];
    const updatedSites = sites.filter((site) => site !== hostToRemove);
    saveSites(updatedSites);
  });
}

/**
 * Handles the "Save proxy settings" button click: validates the address
 * and port fields, saves them to chrome.storage.local, and notifies
 * background.js to rebuild and apply the PAC script with the new proxy
 * server.
 */
function saveProxyConfig() {
  errorMsg.textContent = "";

  const address = proxyAddressInput.value.trim();
  const portValue = proxyPortInput.value.trim();

  if (!address || !isValidHost(address)) {
    errorMsg.textContent = "Please enter a valid proxy server address.";
    return;
  }

  if (!isValidPort(portValue)) {
    errorMsg.textContent = "Please enter a valid port number (1-65535).";
    return;
  }

  const proxyConfig = {
    address: address,
    port: Number(portValue)
  };

  chrome.storage.local.set({ [PROXY_CONFIG_KEY]: proxyConfig }, () => {
    notifyBackgroundToUpdateProxy();
  });
}

// ----------------------------------------------------------------------
// Event listeners
// ----------------------------------------------------------------------

addBtn.addEventListener("click", addSite);

// Allow pressing Enter inside the domain input field to add it
domainInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addSite();
  }
});

saveProxyBtn.addEventListener("click", saveProxyConfig);

// Load and display the current state as soon as the popup opens
document.addEventListener("DOMContentLoaded", loadState);
