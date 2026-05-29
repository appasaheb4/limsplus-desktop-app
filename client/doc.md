This sets the copyright in the exe file properties. However, to fully fix the "Unknown Publisher" warning in the Windows install dialog, you need a code signing certificate. Without it, Windows will always show "Unknown Publisher" because the OS doesn't trust unsigned executables.

Options for code signing:

Free option — Use SignPath which offers free code signing for open-source projects
Paid option — Purchase an EV or OV code signing certificate from providers like DigiCert, Sectigo, or SSL.com (~$200-400/year)
Self-signed (not recommended) — Won't remove the warning on other machines
Once you have a certificate, you'd add to the win config:

"certificateFile": "path/to/certificate.pfx",
"certificatePassword": "your-password"
This is a Windows security requirement — no config change alone can make the "Unknown Publisher" go away without code signing.

## Dev: activation screen vs LimsPlus Lite

`yarn electron:dev` loads the **connector** on **http://127.0.0.1:3000** (activation → home), not the Lite portal.

If you see **LimsPlus Lite** or no activation popup, **port 3000 is used by another app** (often a static server for `app/frontend`). Free the port, then restart:

```bash
lsof -ti :3000 | xargs kill -9   # macOS — stops whatever holds 3000
yarn electron:dev:activation
```

Terminal `[0]` must show `Compiled successfully` — not `Something is already running on port 3000`.

## Show activation key screen again

`yarn electron:dev` skips the gate when `license-activation.secure` already exists.

**Dev** (package name `limsplus-connect`):

```bash
yarn reset-activation
yarn electron:dev
```

Or one command:

```bash
yarn electron:dev:activation
```

**macOS manual paths:**

```bash
rm -f "$HOME/Library/Application Support/limsplus-connect/license-activation.secure"
rm -f "$HOME/Library/Application Support/LimsPlus Connect/license-activation.secure"
```

**Force gate without deleting** (dev only):

```bash
LIMSPLUS_FORCE_ACTIVATION_GATE=1 yarn electron:dev
```
