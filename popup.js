/**
 * popup.js
 * ----------------------------------------------------------------------
 * Handles all UI logic inside the extension's popup window:
 *
 *   1. Loads the current list of proxied sites from chrome.storage.local
 *      and renders it as soon as the popup opens.
 *   2. Validates and normalizes user input when adding a new domain
 *      (strips protocol, "www.", path, port, etc., leaving a clean
 *      domain like "example.com").
 *   3. Saves the updated list back to chrome.storage.local.
 *   4. Notifies background.js whenever the list changes, so it can
 *      rebuild the PAC script and apply it immediately.
 *   5. Removes sites from the list when the user clicks the remove (✕)
 *      button next to an entry.
 * ----------------------------------------------------------------------
 */

// Key used to read/write the site list in chrome.storage.local.
// Must match the same key used in background.js.
const STORAGE_KEY = "proxySites";

// Cache references to the DOM elements we'll be working with
const domainInput = document.getElementById("domain-input");
const addBtn = document.getElementById("add-btn");
const errorMsg = document.getElementById("error-msg");
const siteList = document.getElementById("site-list");

/**
 * Cleans up whatever the user typed into the input field and extracts
 * a plain domain name from it.
 *
 * Examples:
 *   "https://www.example.com/path?x=1"  -> "example.com"
 *   "WWW.Example.com"                   -> "example.com"
 *   "example.com:8080"                  -> "example.com"
 *
 * @param {string} raw - The raw text typed by the user.
 * @returns {string} - A normalized, lowercase domain with no protocol,
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

  // Remove any path, query string, or port, keeping only the host part
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split(":")[0];

  return value;
}

/**
 * Performs a lightweight validation check to confirm that a string
 * looks like a real domain (e.g. "example.com", "sub.example.co.uk").
 * This is not a full RFC-compliant validator, but it's enough to catch
 * obvious typos and prevent garbage entries.
 *
 * @param {string} domain - The normalized domain to validate.
 * @returns {boolean} - True if the domain looks valid.
 */
function isValidDomain(domain) {
  const domainPattern = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})+$/;
  return domainPattern.test(domain);
}

/**
 * Loads the current site list from chrome.storage.local and renders it
 * in the popup. Called once when the popup is opened.
 */
function loadSites() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const sites = result[STORAGE_KEY] || [];
    renderSiteList(sites);
  });
}

/**
 * Renders the given array of sites as a list of items in the popup UI.
 * Each item shows the domain name and a remove ("✕") button.
 * If the list is empty, shows a friendly placeholder message instead.
 *
 * @param {string[]} sites - Array of domains to display.
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
    nameSpan.title = site; // Full domain shown on hover if truncated

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
 * Saves the given site list to chrome.storage.local, re-renders the UI,
 * and notifies background.js so it can rebuild and apply the PAC script.
 *
 * @param {string[]} sites - The full, updated array of domains.
 */
function saveSites(sites) {
  chrome.storage.local.set({ [STORAGE_KEY]: sites }, () => {
    renderSiteList(sites);
    notifyBackgroundToUpdateProxy();
  });
}

/**
 * Sends a message to background.js telling it that the site list has
 * changed, so it can rebuild the PAC script and re-apply proxy settings
 * immediately (no browser restart required).
 */
function notifyBackgroundToUpdateProxy() {
  chrome.runtime.sendMessage({ type: "UPDATE_PROXY_SETTINGS" });
}

/**
 * Handles the "Add" button click: validates the typed domain, checks
 * for duplicates, and if everything looks good, adds it to the list
 * and saves it.
 */
function addSite() {
  errorMsg.textContent = "";

  const rawValue = domainInput.value;
  const domain = normalizeDomain(rawValue);

  if (!domain) {
    errorMsg.textContent = "Please enter a domain.";
    return;
  }

  if (!isValidDomain(domain)) {
    errorMsg.textContent = "Invalid domain format.";
    return;
  }

  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const sites = result[STORAGE_KEY] || [];

    if (sites.includes(domain)) {
      errorMsg.textContent = "This site is already in the list.";
      return;
    }

    sites.push(domain);
    saveSites(sites);
    domainInput.value = "";
  });
}

/**
 * Removes a domain from the site list and saves the updated list.
 *
 * @param {string} domainToRemove - The domain to remove.
 */
function removeSite(domainToRemove) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const sites = result[STORAGE_KEY] || [];
    const updatedSites = sites.filter((site) => site !== domainToRemove);
    saveSites(updatedSites);
  });
}

// ----------------------------------------------------------------------
// Event listeners
// ----------------------------------------------------------------------

addBtn.addEventListener("click", addSite);

// Allow pressing Enter inside the input field to add a domain
domainInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addSite();
  }
});

// Load and display the current site list as soon as the popup opens
document.addEventListener("DOMContentLoaded", loadSites);