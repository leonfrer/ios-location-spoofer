# iOS Location Spoofer

Use your proxy app's HTTPS decryption (MITM) to teleport Apple's location service anywhere in the world — no jailbreak, no computer, no developer account.

**English** | [中文](README_zh-cn.md)

## What it is

An iPhone locates itself by asking Apple "where are these Wi-Fi/cell towers?" using the BSSIDs it can see. Apple replies with a list of coordinates, and iOS computes your position from them.

This project intercepts Apple's reply on its way back and **rewrites every coordinate to the location you want**. Your iPhone does the math on the doctored coordinates and believes it is exactly where you told it to be.

It ships as ready-to-import modules for five proxy apps — no compiling, no dev account, import and go.

## How it works

```
iPhone  ──(BSSID list)──►  Apple gs-loc  ──(coordinates)──►  [ this script rewrites them ]  ──►  iPhone
```

The script hooks the `.../clls/wloc` response from Apple's location servers and replaces the WiFi-hotspot and cell-tower coordinates (and the motion-activity fields) with your target, in whatever wire format Apple used (ARPC / synthetic / marker / bare).

## Supported apps

| App | File | How to import | Status |
|-----|------|---------------|--------|
| Shadowrocket | [`scripts/ios-location-spoofer.sgmodule`](scripts/ios-location-spoofer.sgmodule) | Config → top-right **+** | ✅ verified |
| Surge | [`scripts/ios-location-spoofer-surge.sgmodule`](scripts/ios-location-spoofer-surge.sgmodule) | Home → Modules → Install New Module | ✅ verified |
| Loon | [`scripts/ios-location-spoofer.lnplugin`](scripts/ios-location-spoofer.lnplugin) | Settings → Plugins → Add | ✅ verified |
| Quantumult X | [`scripts/ios-location-spoofer.snippet`](scripts/ios-location-spoofer.snippet) | Settings → Rewrite → Add | 🟡 untested |
| Stash | [`scripts/ios-location-spoofer.stoverride`](scripts/ios-location-spoofer.stoverride) | Override → Install | ✅ verified |

## Step-by-step guide (Shadowrocket)

This walks through Shadowrocket; the other apps follow the same five ideas (enable MITM → trust cert → import module → set coordinates → force a refresh).

### 1. Import the module

1. Open **Shadowrocket** → bottom **Config**
2. Find **Modules** → tap **+** (top-right) → **From URL**, paste:
   ```
   https://raw.githubusercontent.com/hoicau/ios-location-spoofer/main/scripts/ios-location-spoofer.sgmodule
   ```
3. Save, and make sure the **iOS Location Spoofer** row is enabled (✓).

### 2. Turn on HTTPS decryption

1. Open the **HTTPS Decryption** page. The entry differs by version — on Shadowrocket iOS 2.2.88(3308): **Config** → tap the **ⓘ** next to your active config → **HTTPS Decryption**. Older builds: bottom **Settings** → **HTTPS Decryption**.
2. Turn the switch **on** (blue). If there is only one switch, that is normal — it *is* the MITM switch.
3. Confirm the domain list contains these four (usually added automatically by the module):
   ```
   gs-loc.apple.com
   gs-loc-cn.apple.com
   bluedot.is.autonavi.com
   bluedot.is.autonavi.com.gds.alibabadns.com
   ```
   If missing, tap **+**, paste them comma-separated, and save (✓ top-right).

### 3. Install and trust the CA certificate (the step 90% of people miss)

1. On the HTTPS Decryption page tap **Certificate** → **Generate New CA Certificate** → **Install Certificate**.
2. iPhone **Settings → General → VPN & Device Management** → the Shadowrocket profile → **Install** (enter passcode).
3. ⚠️ **Settings → General → About → Certificate Trust Settings** → turn the Shadowrocket certificate **on** (full trust). Decryption does nothing until this switch is on.

### 4. Start the proxy

Back on the Shadowrocket home screen, flip the master switch **on** (green / "Connected"), and **Allow** the VPN configuration prompt the first time.

### 5. Set your target coordinates

The default is Apple Park (Cupertino). To change it: **Config → Modules → iOS Location Spoofer**, edit the `argument=` line:

- `latitude=` → your latitude
- `longitude=` → your longitude

Common coordinates:

| Place | latitude | longitude |
|-------|----------|-----------|
| Tiananmen, Beijing | 39.9087 | 116.3975 |
| The Bund, Shanghai | 31.2397 | 121.4900 |
| Canton Tower, Guangzhou | 23.1066 | 113.3245 |
| Tokyo Tower | 35.6586 | 139.7454 |

> To find any coordinate: open Google/Apple Maps, right-click or long-press the spot → copy coordinates (latitude first, longitude second).

**Also adjust altitude** so you don't look suspicious — leaving altitude at the default 530 m while "in" Shanghai (near sea level) is an obvious tell. Query a spot's real elevation for free:
```
https://api.open-meteo.com/v1/elevation?latitude=31.2397&longitude=121.4900
```
See the [parameters](#changing-the-location) table below for everything you can tune.

### 6. Make it take effect

Apple caches location, so changes are not instant — you have to force a fresh request:

1. **Settings → Privacy & Security → Location Services** → turn **off**, wait 10+ seconds, turn **on**.
2. Open **Maps** or **Weather** to check.
3. If it hasn't changed, **repeat the off/on a few times**. Once it hits, it usually stays put.

## Changing the location

Set these in the module's `argument=` (Shadowrocket/Surge/Stash) or in the Loon plugin UI:

| Name | Default | Description |
|------|---------|-------------|
| `latitude` | 37.3349 | Target latitude |
| `longitude` | -122.00902 | Target longitude |
| `address` | *(empty)* | Address search (Loon plugin UI; resolved online, takes priority over manual lat/lng) |
| `altitude` | 530 | Altitude in metres (negative allowed) |
| `horizontalAccuracy` | 39 | Horizontal accuracy (smaller = "sharper"; 5–15 looks GPS-like) |
| `verticalAccuracy` | 1000 | Vertical accuracy (drop to 10–30 once altitude is real) |
| `failOpen` | true | Pass the original data through on error |
| `debug` | false | Debug logging |

## Loon notes

1. After importing `scripts/ios-location-spoofer.lnplugin`, open the plugin config page under **Settings → Plugins**.
2. You can enter **latitude / longitude** directly; **address search** is resolved and cached by a cron job every 5 minutes (for the first run enter coordinates, or save an address and wait one cron cycle).
3. Loon **MITM must be on** with the cert trusted, and the plugin's four `[mitm]` hostnames active.
4. The plugin ships a **Prepare** request script (sets `Accept-Encoding: identity` to avoid `zip decompress error` / script timeouts).
5. After changing coordinates, toggle Location Services; enable **Debug Log** and search `Location spoofer` in the Loon log.

> If you see `Evaluate script timeout` or `zip decompress error:-3`: update the plugin, reload Loon, and confirm all three scripts (Prepare / Response / Geocode cron) are enabled.

## Advanced: web map picker (Cloudflare Worker)

Changing location often and tired of editing numbers by hand? The repo root **is** a Cloudflare Worker that gives you a tap-the-map picker: click to set location, altitude auto-filled by terrain, accuracy adjustable, plus a one-tap **restore real location** toggle — free (no VPS), HTTPS included, read by Loon / Shadowrocket via `configUrl`.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hoicau/ios-location-spoofer)

### Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/?token=` | GET | Map picker page (**token required**) |
| `/loc.json?token=` | GET | Read coordinates JSON |
| `/set?token=` | POST | Save coordinates (turns spoofing on) |
| `/enable` | POST | Toggle spoofing / restore real location — no token required (`{enabled:false}` passes original data through) |
| `/health` | GET | Health check (no token) |

### Deploy — Option A: one-click, in the browser (no CLI)

1. Click the **Deploy to Cloudflare** button above and sign in to (or create) your Cloudflare account.
2. Cloudflare reads `wrangler.jsonc`, **provisions the `LOC_KV` namespace and fills in its ID automatically**, clones the repo into your own GitHub, then builds & deploys the Worker. Review the resource list it shows, accept the defaults, and wait for the build to finish.
3. **Set the access token** — required; the API rejects reads/saves until it exists. In the dashboard: **Workers & Pages → your worker → Settings → Variables and Secrets → Add**, choose type **Secret**, name it `TOKEN`, and set a long random string as the value (e.g. from `openssl rand -hex 24`), then **Deploy**.
4. If the map page opens but saving fails, check **Settings → Bindings** for a **KV namespace** binding named `LOC_KV`; add one if it is missing.
5. Copy your worker URL (`https://<name>.<account>.workers.dev`) and continue at [Point your proxy app at it](#point-your-proxy-app-at-it).

> Later pushes to your GitHub copy auto-redeploy through Workers Builds.

### Deploy — Option B: paste into the Cloudflare dashboard (no CLI, no GitHub)

Prefer not to connect GitHub? The whole Worker is a single self-contained file, so you can paste it straight into the dashboard editor:

1. **Workers & Pages → Create → Create Worker**, give it a name, and **Deploy** the starter.
2. **Edit code**, delete the starter, and paste the entire contents of [`src/index.js`](src/index.js). **Deploy**.
3. **Settings → Bindings → Add → KV namespace**: variable name `LOC_KV`, then create or select a namespace.
4. **Settings → Variables and Secrets → Add → Secret**: name `TOKEN`, value a long random string (e.g. `openssl rand -hex 24`). **Deploy** once more.
5. Open `https://<name>.<account>.workers.dev/?token=YOUR_TOKEN` — you should see the map. Continue at [Point your proxy app at it](#point-your-proxy-app-at-it).

### Deploy — Option C: with the Wrangler CLI

```bash
# 1. install deps (from repo root)
npm install

# 2. set the access token (use e.g. `openssl rand -hex 24`)
npx wrangler secret put TOKEN

# 3. deploy — the first run auto-creates the LOC_KV namespace and writes
#    its id back into wrangler.jsonc
npm run deploy
```

Prefer to manage the namespace yourself? Create it and add the printed `id` (and `preview_id`) to the `LOC_KV` binding in `wrangler.jsonc` before deploying:

```bash
npx wrangler kv namespace create LOC_KV
npx wrangler kv namespace create LOC_KV --preview
```

For local dev, copy `.dev.vars.example` to `.dev.vars` and fill in `TOKEN=...`, then `npm run dev`.

### Point your proxy app at it

**Loon** → Settings → Plugins → iOS Location Spoofer → **Remote Config URL**:
```
https://your-worker.your-account.workers.dev/loc.json?token=YOUR_TOKEN
```

**Shadowrocket** → append to the module's `argument=`:
```
&configUrl=https://your-worker.your-account.workers.dev/loc.json?token=YOUR_TOKEN
```

Then open the picker on your iPhone at `https://your-worker.your-account.workers.dev/?token=YOUR_TOKEN`, tap the map → **Save** (or **Restore real location** to pass the original data through), and toggle Location Services (Loon refreshes its cache within ~60 s).

Custom domain: Cloudflare Dashboard → Workers → your worker → Settings → Domains.

> Data lives in Workers **KV** (not a local file), which is eventually consistent, so a save may take up to ~60 s to propagate. HTTPS is handled for you.

## Troubleshooting

**Location won't change?** Check in this order:
1. The **Certificate Trust Settings** switch is actually on (step 3 — the most common cause).
2. The module is present and **enabled** (✓).
3. HTTPS decryption is on and all four Apple domains are listed.
4. You **toggled Location Services off/on several times** (Apple caches aggressively).
5. Set `debug=true` and watch the app's log for the intercepted `wloc` request — if you see it, interception works.

**Domains didn't appear after import?** Add the four hostnames manually on the HTTPS Decryption page and save.

**Can I restore my real location?** Yes — disable the module (or the proxy master switch) and refresh location once (step 4).

**Apple News / region-dependent apps still think I'm in the old place?** Some apps also read iOS system services. Open **Settings → Privacy & Security → Location Services → System Services** and turn everything on (especially Location-Based Apple Ads, Significant Locations, iPhone Analytics, Routing & Traffic, Improve Maps), then toggle Location Services once more.

## Project structure

```
.                              # repo root = Cloudflare Worker (web map picker)
├── src/
│   └── index.js               # Worker: API + inlined map picker page (single self-contained file)
├── wrangler.jsonc             # Worker + KV config
├── package.json
├── .dev.vars.example          # copy to .dev.vars for local dev
└── scripts/                   # proxy-app spoofer modules
    ├── location-spoofer.js                 # core script (shared by 4 apps)
    ├── location-spoofer-qx.js              # Quantumult X variant
    ├── location-spoofer-config.json        # config sample
    ├── ios-location-spoofer.sgmodule       # Shadowrocket
    ├── ios-location-spoofer-surge.sgmodule # Surge (parameterized UI)
    ├── ios-location-spoofer.lnplugin       # Loon
    ├── ios-location-spoofer.snippet        # Quantumult X
    └── ios-location-spoofer.stoverride     # Stash
```

## Credits

Built on the core research of [acheong08/ios-location-spoofer](https://github.com/acheong08/ios-location-spoofer) (a standalone Go iOS app using a self-hosted VPN + MITM). This repo ports that logic to JavaScript for five proxy platforms and adds: multi-platform support, cell-tower coordinate rewriting (fields 22/24, not just Wi-Fi), multi-format response detection, and motion-activity spoofing.