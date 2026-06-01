This sets the copyright in the exe file properties. However, to fully fix the "Unknown Publisher" warning in the Windows install dialog, you need a code signing certificate. Without it, Windows will always show "Unknown Publisher" because the OS doesn't trust unsigned executables.

Options for code signing:

Free option — Use SignPath which offers free code signing for open-source projects
Paid option — Purchase an EV or OV code signing certificate from providers like DigiCert, Sectigo, or SSL.com (~$200-400/year)
Self-signed (not recommended) — Won't remove the warning on other machines
Once you have a certificate, you'd add to the win config:

"certificateFile": "path/to/certificate.pfx",
"certificatePassword": "your-password"
This is a Windows security requirement — no config change alone can make the "Unknown Publisher" go away without code signing.

## Lite portal (`app/frontend`) — do not edit for runtime config

The folder `client/app/frontend` is **replaced** when you copy a new portal build (`npm run copy-frontend` or similar). Do **not** put activation company code or bootstrap scripts there.

Runtime values are injected by **Electron** when Lite opens:

| What | Where |
|------|--------|
| Company code (`REACT_APP_LOCAL_LOGIN_COMPANY`) | `user-preferences.json` → `localLoginCompany`, URL query, `lims-lite-offline.json` |
| Portal bootstrap + `getLocalCompanyUrl` | `client/electron/limsPortalDesktopBootstrap.js` served at `/lims-portal-desktop-bootstrap.js` |
| Live config JSON | `/lims-desktop-runtime-config.json` (in-memory while Lite server runs) |
| Connect app helpers | `client/src/runtime/local-login-company.ts` |

After replacing `app/frontend`, restart `yarn electron:dev` — no changes needed inside the copied build.

### Why `getLocalCompanyUrl` always returned GENEFLOW

The portal build often sets `REACT_APP_LOCAL_LOGIN_COMPANY` to **all codes in one string**:

`GENEFLOW GENEFLOW ACCUSTIX DEMO CONFIG TEST`

`getLocalCompanyUrl` uses `switch (company)` with exact cases (`DEMO`, `GENEFLOW`, …). The full string matches **no** case → `default` → `https://geneflow.limsplus.co.in`.

Electron runtime now:

1. Stores a **single** code from activation (`company.code`, e.g. `DEMO`).
2. Patches the served `main.*.js` so `process.env.REACT_APP_LOCAL_LOGIN_COMPANY` is that one code.
3. Bootstrap normalizes multi-word env strings before `switch`.
4. Patches **all** `static/js/*.js` chunks — Login uses `9701.*.js` with `"DEMO GENEFLOW …".split(" ")[0]` (first token is often **DEMO** in newer builds), replaced with your activation code.

Setting `REACT_APP_LOCAL_LOGIN_COMPANY=DEMO` in Connect `.env` does **not** change the copied portal build; activation `company.code` + Electron patch does.

Test in Lite DevTools: `getLocalCompanyUrl('DEMO')` → `https://demo.limsplus.co.in`.

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
