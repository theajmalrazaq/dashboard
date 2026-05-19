import type { APIRoute } from "astro";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import {
  createDashboardDisabledResponse,
  dashboardEnabled,
} from "../../lib/dashboardMode";

const execAsync = promisify(exec);
const BASE_BIN_PATH = "/home/theajmalrazaq/.local/share/omarchy/bin";

declare global {
  var sseClients: Set<ReadableStreamDefaultController<any>>;
  var broadcastSystemState: () => Promise<void>;
}

globalThis.broadcastSystemState = async () => {
  if (!globalThis.sseClients || globalThis.sseClients.size === 0) return;
  try {
    const [toggles, clipboard, spotify, battery, theme, powerProfile, reminders] = await Promise.all([
      getTogglesState(),
      getClipboardState(),
      getSpotifyState(),
      getBatteryState(),
      getThemeState(),
      getPowerProfileState(),
      getRemindersState(),
    ]);
    const data = JSON.stringify({ toggles, clipboard, spotify, battery, theme, powerProfile, reminders });
    for (const controller of globalThis.sseClients) {
      try {
        controller.enqueue(`data: ${data}\n\n`);
      } catch {
        globalThis.sseClients.delete(controller);
      }
    }
  } catch {
    // Silent fail
  }
};

// Fetch battery status
async function getBatteryState(): Promise<{
  percentage: number;
  status: string;
  remainingTime: string;
  capacity: number;
  powerRate: number;
  hasBattery: boolean;
}> {
  try {
    const { stdout: batPath } = await execAsync("upower -e | grep BAT").catch(() => ({ stdout: "" }));
    if (!batPath.trim()) {
      return { percentage: 0, status: "unknown", remainingTime: "", capacity: 0, powerRate: 0, hasBattery: false };
    }
    const { stdout: info } = await execAsync(`upower -i ${batPath.trim()}`).catch(() => ({ stdout: "" }));
    
    const percentage = parseInt(info.match(/percentage:\s+(\d+)%/)?.[1] || "0");
    const status = info.match(/state:\s+(\S+)/)?.[1] || "unknown";
    const remainingTime = info.match(/time to (?:empty|full):\s+(.+)/)?.[1] || "";
    const capacity = parseFloat(info.match(/energy-full:\s+([\d.]+)/)?.[1] || "0");
    const powerRate = parseFloat(info.match(/energy-rate:\s+([\d.]+)/)?.[1] || "0");
    
    return {
      percentage,
      status,
      remainingTime,
      capacity,
      powerRate,
      hasBattery: true,
    };
  } catch {
    return { percentage: 0, status: "unknown", remainingTime: "", capacity: 0, powerRate: 0, hasBattery: false };
  }
}

// Fetch theme state
async function getThemeState(): Promise<{ current: string; available: string[] }> {
  try {
    const [currentRes, listRes] = await Promise.all([
      execAsync("omarchy-theme-current").catch(() => ({ stdout: "" })),
      execAsync("omarchy-theme-list").catch(() => ({ stdout: "" })),
    ]);
    const current = currentRes.stdout.trim();
    const available = listRes.stdout.split("\n").map(t => t.trim()).filter(Boolean);
    return { current, available };
  } catch {
    return { current: "", available: [] };
  }
}

// Fetch power profiles
async function getPowerProfileState(): Promise<{ active: string; available: string[] }> {
  try {
    const [activeRes, listRes] = await Promise.all([
      execAsync("powerprofilesctl get").catch(() => ({ stdout: "" })),
      execAsync("omarchy-powerprofiles-list").catch(() => ({ stdout: "" })),
    ]);
    const active = activeRes.stdout.trim();
    const available = listRes.stdout.split("\n").map(p => p.trim()).filter(Boolean);
    return { active, available };
  } catch {
    return { active: "", available: [] };
  }
}

// Fetch reminders list
async function getRemindersState(): Promise<any[]> {
  const reminderDir = process.env.XDG_RUNTIME_DIR
    ? `${process.env.XDG_RUNTIME_DIR}/omarchy-reminders`
    : `/tmp/omarchy-reminders`;

  const script = `
  timers=$(systemctl --user list-timers --all --no-legend --no-pager "omarchy-reminder-*.timer" 2>/dev/null | awk '{ print $(NF - 1) }')
  uptime=$(awk '{ print int($1) }' /proc/uptime)
  reminder_dir="${reminderDir}"

  parse_systemd_timespan() {
    local timespan="$1"
    local total=0
    local value unit whole
    while read -r value unit; do
      whole=\${value%.*}
      case $unit in
      d) total=$((total + whole * 86400)) ;;
      h) total=$((total + whole * 3600)) ;;
      min) total=$((total + whole * 60)) ;;
      s) total=$((total + whole)) ;;
      esac
    done < <(grep -oE '[0-9]+([.][0-9]+)?(d|h|min|s|ms|us)' <<<"$timespan" | sed -E 's/^([0-9.]+)([a-z]+)$/\\1 \\2/')
    echo "$total"
  }

  echo "["
  first=true
  for timer in $timers; do
    next=$(systemctl --user show -P NextElapseUSecMonotonic "$timer" 2>/dev/null || true)
    [[ -z $next ]] && continue
    next_seconds=$(parse_systemd_timespan "$next")
    ((next_seconds <= uptime)) && continue
    remaining=$((next_seconds - uptime))
    reminder=\${timer%.timer}
    reminder=\${reminder#omarchy-reminder-}
    set_at=\${reminder##*-}
    reminder_minutes=\${reminder%%m-*}
    reminder_message=""
    [[ -f $reminder_dir/\${timer%.timer}.message ]] && reminder_message=$(<"$reminder_dir/\${timer%.timer}.message")
    
    if [ "$first" = true ]; then
      first=false
    else
      echo ","
    fi
    
    cat <<EOF
{
  "timer": "$timer",
  "remaining": $remaining,
  "minutes": $reminder_minutes,
  "set_at": $set_at,
  "message": "\${reminder_message//\\"/\\\\\\"}"
}
EOF
  done
  echo "]"
  `;

  try {
    const { stdout } = await execAsync(script, { shell: "/bin/bash" });
    return JSON.parse(stdout);
  } catch (err) {
    return [];
  }
}

// Combined toggle execution command to avoid spawning 8 separate bash shells
async function getTogglesState(): Promise<Record<string, boolean>> {
  const combinedCmd = `
pgrep -x hypridle >/dev/null && echo "toggle-idle:on" || echo "toggle-idle:off"
hyprctl hyprsunset temperature 2>/dev/null | grep -oE '[0-9]+' | grep -q '4000' && echo "toggle-nightlight:on" || echo "toggle-nightlight:off"
pgrep -x waybar >/dev/null && echo "toggle-waybar:on" || echo "toggle-waybar:off"
makoctl mode 2>/dev/null | grep -q 'do-not-disturb' && echo "toggle-notification-silencing:on" || echo "toggle-notification-silencing:off"
[[ ! -f ~/.local/state/omarchy/toggles/screensaver-off ]] && echo "toggle-screensaver:on" || echo "toggle-screensaver:off"
[[ ! -f ~/.local/state/omarchy/toggles/suspend-off ]] && echo "toggle-suspend:on" || echo "toggle-suspend:off"
supergfxctl -g 2>/dev/null | grep -q 'Hybrid' && echo "toggle-hybrid-gpu:on" || echo "toggle-hybrid-gpu:off"
pgrep -x gnirehtet >/dev/null && echo "gnirehtet:on" || echo "gnirehtet:off"
[[ ! -f ~/.local/state/omarchy/toggles/hypr/touchpad-disabled.conf ]] && echo "toggle-touchpad:on" || echo "toggle-touchpad:off"
[[ ! -f ~/.local/state/omarchy/toggles/hypr/touchscreen-disabled.conf ]] && echo "toggle-touchscreen:on" || echo "toggle-touchscreen:off"
`;
  try {
    const { stdout } = await execAsync(combinedCmd, { shell: "/bin/bash" });
    const states: Record<string, boolean> = {};
    stdout.split("\n").forEach((line) => {
      const parts = line.split(":");
      if (parts.length === 2) {
        states[parts[0]] = parts[1].trim() === "on";
      }
    });
    return states;
  } catch {
    return {};
  }
}

// Check status of a single toggle command
async function getSingleToggleState(command: string): Promise<string> {
  let checkCmd = "";
  switch (command) {
    case "toggle-idle":
      checkCmd = 'pgrep -x hypridle >/dev/null && echo "on" || echo "off"';
      break;
    case "toggle-nightlight":
      checkCmd =
        "hyprctl hyprsunset temperature 2>/dev/null | grep -oE '[0-9]+' | grep -q '4000' && echo 'on' || echo 'off'";
      break;
    case "toggle-waybar":
      checkCmd = 'pgrep -x waybar >/dev/null && echo "on" || echo "off"';
      break;
    case "toggle-notification-silencing":
      checkCmd =
        "makoctl mode | grep -q 'do-not-disturb' && echo 'on' || echo 'off'";
      break;
    case "toggle-screensaver":
      checkCmd =
        '[[ ! -f ~/.local/state/omarchy/toggles/screensaver-off ]] && echo "on" || echo "off"';
      break;
    case "toggle-suspend":
      checkCmd =
        '[[ ! -f ~/.local/state/omarchy/toggles/suspend-off ]] && echo "on" || echo "off"';
      break;
    case "toggle-hybrid-gpu":
      checkCmd =
        "supergfxctl -g 2>/dev/null | grep -q 'Hybrid' && echo 'on' || echo 'off'";
      break;
    case "gnirehtet":
      checkCmd = 'pgrep -x gnirehtet >/dev/null && echo "on" || echo "off"';
      break;
    case "toggle-touchpad":
      checkCmd = '[[ ! -f ~/.local/state/omarchy/toggles/hypr/touchpad-disabled.conf ]] && echo "on" || echo "off"';
      break;
    case "toggle-touchscreen":
      checkCmd = '[[ ! -f ~/.local/state/omarchy/toggles/hypr/touchscreen-disabled.conf ]] && echo "on" || echo "off"';
      break;
    default:
      return "unknown";
  }
  try {
    const { stdout } = await execAsync(checkCmd, { shell: "/bin/bash" });
    return stdout.trim();
  } catch {
    return "off";
  }
}

// Fetch clipboard history and current clipboard item
async function getClipboardState(): Promise<{
  history: any[];
  current: string;
  backend: string;
}> {
  try {
    const { stdout: listOutput } = await execAsync(
      'elephant query "clipboard;;30;false"',
    ).catch(() => ({ stdout: "" }));
    const items = listOutput
      .split("\n")
      .filter((line) => line.trim().startsWith("item:"))
      .map((line) => {
        const getField = (field: string) => {
          const regex = new RegExp(`${field}:"([^"]*)"`);
          const match = line.match(regex);
          return match ? match[1].replace(/\\n/g, "\n") : "";
        };
        return {
          id: getField("identifier"),
          preview: getField("preview") || getField("text"),
          subtext: getField("subtext"),
          type: line.match(/preview_type:"file"/) ? "file" : "text",
        };
      });
    const { stdout: current } = await execAsync("wl-paste -n").catch(() => ({
      stdout: "",
    }));
    return { history: items, current: current.trim(), backend: "elephant" };
  } catch {
    return { history: [], current: "", backend: "elephant" };
  }
}

// Fetch Spotify status efficiently in a single host call
async function getSpotifyState(): Promise<any> {
  const combinedCmd = `
if playerctl -p spotify status >/dev/null 2>&1; then
    echo "spotify-active:true"
    echo "spotify-status:$(playerctl -p spotify status 2>/dev/null)"
    echo "spotify-title:$(playerctl -p spotify metadata title 2>/dev/null)"
    echo "spotify-artist:$(playerctl -p spotify metadata artist 2>/dev/null)"
    echo "spotify-length:$(playerctl -p spotify metadata mpris:length 2>/dev/null)"
    echo "spotify-position:$(playerctl -p spotify position 2>/dev/null)"
    echo "spotify-arturl:$(playerctl -p spotify metadata mpris:artUrl 2>/dev/null)"
else
    echo "spotify-active:false"
fi
`;
  try {
    const { stdout } = await execAsync(combinedCmd, { shell: "/bin/bash" });
    const data: Record<string, string> = {};
    stdout.split("\n").forEach((line) => {
      const index = line.indexOf(":");
      if (index !== -1) {
        data[line.substring(0, index).trim()] = line
          .substring(index + 1)
          .trim();
      }
    });

    if (data["spotify-active"] === "true") {
      const lengthMicro = data["spotify-length"] || "0";
      const length = parseFloat(lengthMicro) / 1000000;
      const position = data["spotify-position"] || "0";
      let artUrl = data["spotify-arturl"] || "";
      if (artUrl.startsWith("file://")) {
        artUrl = "";
      }

      return {
        active: true,
        isPlaying: data["spotify-status"] === "Playing",
        position: parseFloat(position),
        duration: length,
        track: {
          title: data["spotify-title"] || "Watching Spotify...",
          artist: data["spotify-artist"] || "Linux Player",
          artUrl: artUrl || null,
        },
      };
    }
    return { active: false };
  } catch {
    return { active: false };
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!dashboardEnabled) {
    return createDashboardDisabledResponse();
  }

  const action = url.searchParams.get("action") || "scripts";
  const targetPath = url.searchParams.get("path");

  if (action === "stream") {
    if (!globalThis.sseClients) {
      globalThis.sseClients = new Set();
    }

    const signal = request.signal;
    let interval: any;

    const stream = new ReadableStream({
      start(controller) {
        globalThis.sseClients.add(controller);

        const sendState = async () => {
          if (signal.aborted) {
            clearInterval(interval);
            globalThis.sseClients.delete(controller);
            try {
              controller.close();
            } catch {}
            return;
          }
          try {
            const [toggles, clipboard, spotify, battery, theme, powerProfile, reminders] = await Promise.all([
              getTogglesState(),
              getClipboardState(),
              getSpotifyState(),
              getBatteryState(),
              getThemeState(),
              getPowerProfileState(),
              getRemindersState(),
            ]);
            const data = JSON.stringify({ toggles, clipboard, spotify, battery, theme, powerProfile, reminders });
            controller.enqueue(`data: ${data}\n\n`);
          } catch {
            globalThis.sseClients.delete(controller);
          }
        };

        // Send first chunk immediately
        sendState();

        // Poll every 2 seconds
        interval = setInterval(sendState, 2000);

        signal.addEventListener("abort", () => {
          clearInterval(interval);
          globalThis.sseClients.delete(controller);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel(controller) {
        globalThis.sseClients.delete(controller);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Encoding": "none",
      },
    });
  }

  try {
    let responseData;
    let status = 200;

    // Standard REST actions (called as one-off queries by components)
    if (action === "state") {
      const [toggles, clipboard, spotify, battery, theme, powerProfile, reminders] = await Promise.all([
        getTogglesState(),
        getClipboardState(),
        getSpotifyState(),
        getBatteryState(),
        getThemeState(),
        getPowerProfileState(),
        getRemindersState(),
      ]);
      responseData = { toggles, clipboard, spotify, battery, theme, powerProfile, reminders };
    } else if (action === "scripts") {
      const files = await fs.readdir(BASE_BIN_PATH);
      responseData = await Promise.all(
        files
          .filter((file) => file.startsWith("omarchy-"))
          .map(async (file) => {
            const stats = await fs.stat(path.join(BASE_BIN_PATH, file));
            return { name: file, size: stats.size, mtime: stats.mtime };
          }),
      );
    } else if (action === "ls" && targetPath) {
      if (!targetPath.startsWith("/home/theajmalrazaq")) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
        });
      }
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      responseData = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(targetPath, entry.name);
          const stats = await fs.stat(fullPath);
          return {
            name: entry.name,
            kind: entry.isDirectory() ? "directory" : "file",
            size: stats.size,
            mtime: stats.mtime,
            path: fullPath,
          };
        }),
      );
    } else if (action === "read" && targetPath) {
      if (!targetPath.startsWith("/home/theajmalrazaq")) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
        });
      }
      const content = await fs.readFile(targetPath, "utf-8");
      responseData = { content };
    } else if (action === "validate" && targetPath) {
      if (!targetPath.startsWith("/home/theajmalrazaq")) {
        return new Response(
          JSON.stringify({ exists: false, error: "Access denied" }),
          { status: 403 },
        );
      }
      try {
        const stats = await fs.stat(targetPath);
        responseData = { exists: stats.isDirectory(), path: targetPath };
      } catch {
        try {
          const parentPath = path.dirname(targetPath);
          const basename = path.basename(targetPath).toLowerCase();
          const entries = await fs.readdir(parentPath, { withFileTypes: true });
          const match = entries.find(
            (e) => e.isDirectory() && e.name.toLowerCase() === basename,
          );
          if (match) {
            const resolvedPath = path.join(parentPath, match.name);
            responseData = { exists: true, path: resolvedPath };
          } else {
            responseData = { exists: false };
          }
        } catch {
          responseData = { exists: false };
        }
      }
    } else if (action === "status" && targetPath) {
      const command = targetPath.replace("omarchy-", "");
      const toggleStatus = await getSingleToggleState(command);
      responseData = { status: toggleStatus };
    } else if (action === "file-proxy" && targetPath) {
      if (!targetPath.startsWith("/home/theajmalrazaq/.cache/elephant")) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
        });
      }
      try {
        const fileContent = await fs.readFile(targetPath);
        const ext = path.extname(targetPath).toLowerCase();
        const contentType =
          ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : "application/octet-stream";
        return new Response(new Uint8Array(fileContent), {
          status: 200,
          headers: { "Content-Type": contentType },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "File not found" }), {
          status: 404,
        });
      }
    } else if (action === "clipboard") {
      responseData = await getClipboardState();
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
      });
    }

    return new Response(JSON.stringify(responseData), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!dashboardEnabled) {
    return createDashboardDisabledResponse();
  }

  try {
    const body = await request.json();
    const { action = "bin", command, args = [], cwd = BASE_BIN_PATH } = body;

    if (!command || typeof command !== "string") {
      return new Response(JSON.stringify({ error: "Command is required" }), {
        status: 400,
      });
    }

    try {
      const stats = await fs.stat(cwd);
      if (!stats.isDirectory()) throw new Error("CWD is not a directory");
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Directory not found: ${cwd}`,
        }),
        { status: 400 },
      );
    }

    let fullCommand = "";
    if (action === "bin") {
      if (command.includes("..") || command.includes("/")) {
        return new Response(JSON.stringify({ error: "Invalid bin command" }), {
          status: 400,
        });
      }
      const sanitizedArgs = args
        .map((arg: any) =>
          typeof arg === "string" ? `'${arg.replace(/'/g, "'\\''")}'` : arg,
        )
        .join(" ");
      fullCommand = `${BASE_BIN_PATH}/${command} ${sanitizedArgs}`.trim();
    } else if (action === "exec") {
      fullCommand = command;
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
      });
    }

    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd,
      timeout: 15000,
    });

    if (globalThis.broadcastSystemState) {
      globalThis.broadcastSystemState().catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, stdout, stderr }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: e.message || "Command failed",
        stdout: e.stdout || "",
        stderr: e.stderr || "",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
