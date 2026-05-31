# City Drive 3D — Online Multiplayer Racing

Open-world 3D multiplayer racing with a top-down angled camera, built for
desktop **and** mobile browsers.

- **Client:** React + Vite + Three.js (via React Three Fiber) +
  postprocessing (Bloom / SMAA / Vignette)
- **Server:** Node.js + Colyseus (authoritative arcade-style vehicle
  simulation, 30 Hz tick rate)
- **Shared:** TypeScript types and constants (car catalog, message types,
  world size)
- **Mobile UI:** virtual steering wheel, gas / brake pedals, handbrake
- **Capacity:** up to **16 players per room**

> Status: MVP. Vehicles drive, multiplayer state synchronizes, four cars
> are selectable, the city is a procedurally generated grid placeholder
> ready to be swapped for richer assets.

---

## Repository layout

```
3d-g/
├── packages/
│   ├── shared/   ← types, car catalog, constants (used by both ends)
│   ├── server/   ← Colyseus game server (Node.js + ws)
│   └── client/   ← React + R3F web client
├── pnpm-workspace.yaml
└── package.json
```

The three packages are linked through pnpm workspaces; the client and
server import the shared package as `@3dg/shared`.

---

## Local development

### Prerequisites

- Node.js **20+** (tested on 22)
- pnpm **9+** (`npm i -g pnpm` if you don't have it)

### Install

```bash
pnpm install
```

### Run server + client together

```bash
pnpm dev
```

Or, in two terminals:

```bash
pnpm dev:server   # game server on http://localhost:2567
pnpm dev:client   # Vite dev server on http://localhost:5173
```

> **Important:** while developing, open **`http://<host>:5173/`** (Vite),
> not `:2567/`. The game server only serves the WebSocket, `/health`, and
> `/colyseus` monitor in dev mode — visiting `:2567/` shows a landing
> page with these instructions, not the game.
>
> The client auto-detects the server: if the page is loaded from port
> `5173` it connects to `ws://<host>:2567`; otherwise it uses the same
> origin as the page (handy when the server hosts both, see below).
> Override with `VITE_SERVER_URL` if you have a custom setup:
>
> ```bash
> VITE_SERVER_URL=wss://yourdomain.com pnpm -F @3dg/client build
> ```

### Single-port production mode

After `pnpm build`, the server automatically picks up the built client
from `packages/client/dist/` and serves it from `/`. So in production
you only need **one** process and **one** port:

```bash
pnpm build
pnpm start:server   # → http://<host>:2567/  (the whole game)
```

### Type-check / build everything

```bash
pnpm typecheck
pnpm build
```

---

## Controls

### Desktop / Keyboard

| Key                | Action            |
| ------------------ | ----------------- |
| `W` / `↑`          | Throttle (gas)    |
| `S` / `↓`          | Brake / reverse   |
| `A` / `←`          | Steer left        |
| `D` / `→`          | Steer right       |
| `Space`            | Handbrake (ручник)|
| `R`                | Reset / respawn   |

### Mobile / Touch

When opened on a touch device the on-screen controls appear automatically:

- **Bottom-left** — virtual steering wheel (drag to rotate, releases back
  to center on lift)
- **Bottom-right** — gas (green) and brake (red) pedals
- **Top-right** — handbrake button (РУЧНИК)

The viewport is locked: no pinch-zoom, no pull-to-refresh, no double-tap
zoom — see `index.html` for the meta tags involved.

---

## Multiplayer architecture

```
   Browser  ──WS── Colyseus Room ──tick─→ State
       ↑              30 Hz              │
       │      State broadcast (delta)    │
       └─────────────────────────────────┘
```

- The client sends compact input snapshots (`throttle`, `brake`, `steer`,
  `handbrake`, `reset`) at the server tick rate.
- The server runs an **authoritative** arcade vehicle simulation (bicycle
  steering, lateral-grip slide on handbrake, soft top-speed clamp).
- The server broadcasts `PlayerState` (position, quaternion, velocity,
  RPM proxy, wheel steer angle) via Colyseus' delta state replication.
- The client smooth-snaps every car (local + remote) toward the latest
  authoritative pose every render frame, masking the 30 Hz tick.

Anti-cheat / determinism: because all motion is computed server-side
clients can only *suggest* input, not state, so position/teleport hacks
are impossible without compromising the server.

---

## Deploying to your VPS

This guide assumes Ubuntu / Debian on an 8 vCore / 16 GB VPS that already
has a public IP and a domain name pointing at it. Adjust as needed.

### 1. Install runtimes

```bash
sudo apt update && sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pnpm pm2
```

### 2. Clone and build

```bash
git clone https://github.com/safiollohaminov542-commits/3d-g.git
cd 3d-g
pnpm install
pnpm build
```

### 3. Run the game server with PM2

```bash
pm2 start packages/server/dist/index.js \
  --name 3dg-server \
  --update-env \
  --time \
  -- \
  PORT=2567 HOST=0.0.0.0
pm2 save
pm2 startup        # follow the printed command to enable on-boot start
```

Health check:

```bash
curl http://localhost:2567/health
# → {"ok":true,"ts":...}
```

### 4. Serve the client

The client is a static SPA. Build it with the public server URL baked in,
then serve it from any static host or from the same VPS via Nginx.

```bash
VITE_SERVER_URL=wss://yourdomain.com/ws \
  pnpm -F @3dg/client build
```

The `dist/` folder under `packages/client/dist` contains everything to
host. Copy it to your web root:

```bash
sudo mkdir -p /var/www/citydrive
sudo cp -r packages/client/dist/* /var/www/citydrive/
```

### 5. Nginx reverse proxy (TLS + WebSocket)

`/etc/nginx/sites-available/citydrive`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Static client
    root /var/www/citydrive;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Colyseus WebSocket (matches VITE_SERVER_URL=wss://.../ws)
    location /ws {
        proxy_pass http://127.0.0.1:2567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600;
    }

    # Optional: protect /colyseus monitor with basic auth
    location /colyseus {
        proxy_pass http://127.0.0.1:2567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        # auth_basic "Admin";
        # auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/citydrive /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com   # Let's Encrypt cert (once)
```

That's it — open `https://yourdomain.com/` on a phone or laptop, pick a
car, and drive.

### 6. Firewall

Open only the ports you actually use externally:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

The Colyseus port `2567` does **not** need to be public — Nginx proxies it.

---

## Roadmap

- [ ] Replace placeholder car primitives with GLTF models (Quaternius / Sketchfab CC).
- [ ] Replace box-buildings with a more interesting city (asset packs, baked lighting).
- [ ] Server-side collision detection between cars and buildings.
- [ ] Client-side prediction + server reconciliation for laggy connections.
- [ ] Race tracks, lap counting, leaderboard.
- [ ] Engine / tire / collision audio.
- [ ] Persistent player accounts.

---

## License

Source code: MIT (or your preference — update before publishing publicly).
