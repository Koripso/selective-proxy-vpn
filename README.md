# Selective Proxy VPN

A Chrome extension (Manifest V3) that routes web traffic through a SOCKS5 proxy **only** for domains explicitly added by the user. All other traffic bypasses the proxy entirely and connects directly (DIRECT).

## Features

- Add and remove domains through a simple popup interface
- Automatic input normalization (strips `http://`, `https://`, `www.`, paths, and ports from whatever the user types)
- Subdomain matching — a rule added for `example.com` automatically covers subdomains like `mail.example.com` or `shop.example.com`
- Instant PAC script rebuild and re-application whenever the site list changes, with no need to restart the browser
- Persistent storage of the site list via `chrome.storage.local`

## How it works

The extension builds a **PAC (Proxy Auto-Config) script** on the fly, based on the list of domains stored by the user. Chrome calls this script for every outgoing request:

- If the requested host matches one of the user's domains (or is a subdomain of one), the request is routed through a SOCKS5 proxy.
- Otherwise, the request goes `DIRECT` — no proxy involved.

This means only the sites you explicitly choose have their traffic proxied; everything else behaves exactly as it would without the extension installed.

## Tech stack

- Manifest V3
- Chrome Proxy API (`chrome.proxy.settings`)
- PAC scripts (Proxy Auto-Config)
- Vanilla JavaScript — no frameworks, no external dependencies

## Installation

1. Clone this repository:
```bash
   git clone https://github.com/Koripso/selective-proxy-vpn.git
```
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the project folder.

## Configuring your proxy server

Open `background.js` and replace the placeholder SOCKS5 address with your own proxy server's address and port:

```javascript
const PROXY_ADDRESS = "123.45.67.89";
const PROXY_PORT = 1080;
```

After editing, reload the extension from `chrome://extensions/` for the change to take effect.

### Setting up a SOCKS5 proxy for testing

If you don't already have a SOCKS5 server, the quickest way to test this extension is via an SSH tunnel to any server you have SSH access to:

```bash
ssh -D 1080 -N -f user@your-server-ip
```

This opens a local SOCKS5 proxy at `127.0.0.1:1080` that tunnels traffic through your remote server. In that case, set:

```javascript
const PROXY_ADDRESS = "127.0.0.1";
const PROXY_PORT = 1080;
```

## Usage

1. Click the extension icon to open the popup.
2. Type a domain (e.g. `example.com`) and click **Add**.
3. Traffic to that domain — and any of its subdomains — will now be routed through your configured proxy.
4. Click the **✕** button next to any listed domain to remove it and instantly restore direct connections for that site.

## Project structure

selective-proxy-vpn/
├── manifest.json    — Extension configuration and permissions
├── background.js    — Builds and applies the PAC script; manages proxy state
├── popup.html       — Popup UI markup and styling
├── popup.js         — Popup UI logic (add/remove sites, storage sync)
└── README.md        — Project documentation

## Known limitations

- The proxy address is currently hardcoded as a placeholder in `background.js` and must be manually replaced.
- Proxy servers that require authentication (username/password) are not yet supported out of the box — this would require additionally handling the `chrome.webRequest.onAuthRequired` event.

## License

MIT