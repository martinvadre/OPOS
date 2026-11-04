# OPOS

OPOS is a point-of-sale app. The local server stores products and sales in `pos-data.json` and the salted password hash in `credentials.json`. These files stay on this Mac in local mode. The interface works in Safari on a Mac or iPad.

## Start on the Mac

Requires Node.js 22.13 or newer and npm. Double-click `start.command` to launch the local app. The first launch asks you to create a password of at least 12 characters. Keep the terminal window open while using OPOS.

Open `http://localhost:3000` on the Mac. A device on the same Wi-Fi can use the Mac's IP address, such as `http://192.168.1.105:3000` while that address remains assigned to this Mac. The Mac must stay awake and online. macOS may ask you to allow Node incoming connections.

Back up `pos-data.json`, `credentials.json`, and `promptpay-id.txt` together. To change the password, stop the server, run `./set-password.command`, then restart it; existing sales remain intact. The data file supports one running OPOS server process. The old, empty `pos.sqlite` is no longer used.

## iPad on another network

A local IP address only works on the same network. For access elsewhere, install Tailscale on the Mac and iPad, connect both to the same account, then run `tailscale serve --bg 3000` on the Mac. Open the HTTPS address from `tailscale serve status` in iPad Safari. The Tailscale command currently on this Mac points to a missing app, so reinstalling Tailscale is needed for this option.

## Using OPOS

Add or edit products in **Menu**. Tap products to fill the basket, then check out to record a sale. Cash checkout checks the amount received and calculates change. If enabled in Settings, PromptPay checkout generates a QR code for the current total; the QR code does not verify payment automatically. **Reports** shows sales by date and payment method. Product deletion hides it from the catalog and keeps past sales.

Run `npm run build && npm test` to check the UI build and sale/stock behavior.

## Release versions

OPOS releases start at `1.0.0`. Increment the middle number for a larger feature update and reset the last number to zero, for example `1.1.0`. Increment the last number for a small patch, for example `1.1.1`. Tag releases with a `v` prefix.
