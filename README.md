# 🌌 Ajmal's System Dashboard

A modern, highly premium, system-aware standalone dashboard built with Astro, React, and Tailwind CSS. It integrates directly with host desktop systems (Hyprland, playerctl, wl-clipboard) and cloud databases (Supabase).

---

## 🚀 Docker Setup (Recommended)

The dashboard includes a fully optimized multi-stage `Dockerfile` and a `docker-compose.yml` that mounts required host paths so that system commands (window management, volume, media control, clipboard, etc.) work from within the container.

### Fast Start

Build and start the container in detached mode:

```bash
pnpm docker
# or directly:
docker compose up -d --build
```

Then open [http://localhost:4321/dashboard](http://localhost:4321/dashboard) in your browser.

### Custom Ports

If port `4321` is already in use by another process on your host, you can easily launch the container on an alternative port (e.g., `4323`) using the `HOST_PORT` environment variable:

```bash
HOST_PORT=4323 docker compose up -d
```

---

## 🛠️ Local Development

To run the application directly on your host machine:

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:4321/dashboard](http://localhost:4321/dashboard) to view it.

### 3. Production Build & Start

```bash
pnpm build
pnpm start
```

---

## ⚙️ Configuration & Environment

The app uses standard environment variables in a `.env` file for API services and Supabase storage.

Create a `.env` file based on `.env.example`:

```ini
PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_GITHUB_FEED_TOKEN=your-github-token
```

### 🐧 Desktop Host Integration Notes

For containerized mode to successfully control the host environment:

- **Host Mounts:** The `docker-compose.yml` mounts your home directory, temporary runtime paths (`XDG_RUNTIME_DIR`), and `/tmp/hypr` so commands can interact with Hyprland and standard desktop sockets.
- **Permissions:** If your Linux user has a UID/GID other than `1000`, set `LOCAL_UID` and `LOCAL_GID` in your environment before building to ensure container permissions match your user:
  ```bash
  LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up -d --build
  ```
- **Prerequisites:** Desktop-control features like Hyprland, Spotify controller, clipboards, and other host integrations depend on the host desktop session running and being available to the container.
