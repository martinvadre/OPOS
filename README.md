# POS

The Mac hosts the POS and stores products, stock, and sales in `pos-data.json`. The sign-in password is stored as a salted hash in `password.hash`. Both files stay on this Mac. The interface uses shadcn/ui components and works in Safari on a Mac or iPad.

## Start on the Mac

Requires Node.js 22.13 or newer and npm. Double-click `start.command` (the first launch installs the UI packages). The first launch asks you to create a password of at least 12 characters. Keep the terminal window open while using the POS.

Open `http://localhost:3000` on the Mac. A device on the same Wi-Fi can use the Mac's IP address, such as `http://192.168.1.105:3000` while that address remains assigned to this Mac. The Mac must stay awake and online. macOS may ask you to allow Node incoming connections.

Back up `pos-data.json`, `password.hash`, and `promptpay-id.txt` together. To change the password, stop the server, run `./set-password.command`, then restart it; existing sales remain intact. The data file supports one running POS server process. The old, empty `pos.sqlite` is no longer used.

## iPad on another network

A local IP address only works on the same network. For access elsewhere, install Tailscale on the Mac and iPad, connect both to the same account, then run `tailscale serve --bg 3000` on the Mac. Open the HTTPS address from `tailscale serve status` in iPad Safari. The Tailscale command currently on this Mac points to a missing app, so reinstalling Tailscale is needed for this option.

## Using the POS

Add or edit products in **Inventory**. Tap products to fill the basket, which stays in this browser after a refresh; checkout records a sale and reduces stock. Cash checkout checks the amount received and calculates change. PromptPay checkout generates a QR code for the current total using the phone number or national ID in `promptpay-id.txt`. Confirm the payment in your bank app before pressing **Record sale**; the QR code does not verify payment automatically. **Reports** shows the most recent 100 sales and summary figures for those sales. Product deletion hides it from the catalog and keeps past sales.

Run `npm run build && npm test` to check the UI build and sale/stock behavior.
