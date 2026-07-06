# Selective Proxy VPN

A Chrome extension (Manifest V3) that routes web traffic through a SOCKS5 proxy **only** for domains explicitly added by the user. All other traffic bypasses the proxy entirely and connects directly (DIRECT).

<img width="582" height="596" alt="image" src="https://github.com/user-attachments/assets/90cfa79d-4d83-4cd9-8dfd-83c9586d4896" />


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

Open the extension popup and enter your SOCKS5 proxy server's address and port directly in the **"Proxy server (SOCKS5)"** section, then click **Save proxy settings**. No code editing required — the extension stores this configuration in `chrome.storage.local` and applies it immediately.

### Setting up a SOCKS5 proxy for testing

If you don't already have a SOCKS5 server, the quickest way to test this extension is via an SSH tunnel to any server you have SSH access to:

```bash
ssh -D 1080 -N -f user@your-server-ip
```

This opens a local SOCKS5 proxy at `127.0.0.1:1080` that tunnels traffic through your remote server. These are also the default values pre-filled in the popup.

## Usage

1. Click the extension icon to open the popup.
2. Under **"Proxy server (SOCKS5)"**, enter your proxy's address and port, then click **Save proxy settings**.
3. Under **"Sites routed through proxy"**, type a domain, IP address, or `localhost`, then click **Add**.
4. Traffic to that host — and any of its subdomains, if it's a domain — will now be routed through your configured proxy.
5. Click the **✕** button next to any listed entry to remove it and instantly restore direct connections for that host.


## Project structure

| File | Description |
|---|---|
| `manifest.json` | Extension configuration and permissions |
| `background.js` | Builds and applies the PAC script; manages proxy state |
| `popup.html` | Popup UI markup and styling |
| `popup.js` | Popup UI logic (add/remove sites, storage sync) |
| `README.md` | Project documentation |


## Known limitations

- Proxy servers that require authentication (username/password) are not yet supported out of the box — this would require additionally handling the `chrome.webRequest.onAuthRequired` event.
- IDN (internationalized/Unicode) domain names are not currently supported by the validation logic.
- `host_permissions: ["<all_urls>"]` and the `proxy` permission are broad by design (the extension needs to inspect every request to decide whether to proxy it). If you plan to publish this extension on the Chrome Web Store, be prepared to justify these permissions and provide a privacy policy.

## License

MIT
