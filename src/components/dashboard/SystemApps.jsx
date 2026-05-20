import { useState, useEffect, useMemo } from "react";

// Keywords matched against script name AFTER stripping "omarchy-" prefix
const CATEGORIES = [
  {
    id: "session",
    name: "session",
    icon: "hgi-logout-03",
    keywords: [
      "lock-screen",
      "system-logout",
      "system-reboot",
      "system-shutdown",
      "toggle-suspend",
      "toggle-idle",
      "toggle-screensaver",
      "launch-screensaver",
    ],
  },
  {
    id: "display",
    name: "display",
    icon: "hgi-sun-01",
    // display + keyboard brightness merged
    keywords: [
      "brightness-display",
      "brightness-keyboard",
      "toggle-nightlight",
      "theme-bg-",
      "hyprland-monitor-scaling",
    ],
  },
  {
    id: "apps",
    name: "apps",
    icon: "hgi-rocket",
    // launch + restart merged
    keywords: ["launch-", "restart-"],
  },
  {
    id: "system",
    name: "system",
    icon: "hgi-settings-04",
    // theme + update + toggles + hardware + notifications + menu + networking
    keywords: [
      "theme-",
      "update",
      "toggle-",
      "hyprland-window-",
      "hyprland-workspace-",
      "menu",
      "gnirehtet",
      "reverse",
      "hotspot",
    ],
  },
];

// Session: primary power actions shown as big cards
const SESSION_PRIMARY = [
  "system-shutdown",
  "system-reboot",
  "system-logout",
  "lock-screen",
];

const SESSION_META = {
  "system-shutdown": {
    icon: "hgi-shut-down",
    label: "Shut Down",
    color: "red",
  },
  "system-reboot": { icon: "hgi-refresh", label: "Restart", color: "amber" },
  "system-logout": { icon: "hgi-logout-03", label: "Log Out", color: "blue" },
  "lock-screen": { icon: "hgi-lock", label: "Lock", color: "neutral" },
};

const COLOR_MAP = {
  red: {
    bg: "bg-red-500/8 dark:bg-red-500/10",
    border: "border-red-200/60 dark:border-red-500/20",
    icon: "text-red-400 dark:text-red-400",
    hover: "hover:bg-red-500/15 hover:border-red-400/40",
    busy: "border-red-400/60 bg-red-500/15",
  },
  amber: {
    bg: "bg-amber-500/8 dark:bg-amber-500/10",
    border: "border-amber-200/60 dark:border-amber-500/20",
    icon: "text-amber-400 dark:text-amber-400",
    hover: "hover:bg-amber-500/15 hover:border-amber-400/40",
    busy: "border-amber-400/60 bg-amber-500/15",
  },
  blue: {
    bg: "bg-blue-500/8 dark:bg-blue-500/10",
    border: "border-blue-200/60 dark:border-blue-500/20",
    icon: "text-blue-400 dark:text-blue-400",
    hover: "hover:bg-blue-500/15 hover:border-blue-400/40",
    busy: "border-blue-400/60 bg-blue-500/15",
  },
  neutral: {
    bg: "bg-gray-50 dark:bg-neutral-900/60",
    border: "border-gray-200 dark:border-neutral-800",
    icon: "text-gray-600 dark:text-neutral-500",
    hover:
      "hover:bg-gray-100/60 hover:border-gray-300 dark:hover:bg-neutral-800/60 dark:hover:border-neutral-700",
    busy: "border-gray-400/60 bg-gray-100",
  },
};

const SCRIPT_ICON_MAP = {
  "system-shutdown": "hgi-shut-down",
  "system-reboot": "hgi-refresh-01",
  "system-logout": "hgi-logout-03",
  "lock-screen": "hgi-lock",
  "toggle-suspend": "hgi-moon-02",
  "toggle-idle": "hgi-clock-01",
  "toggle-screensaver": "hgi-computer",
  "launch-screensaver": "hgi-computer",
};

const getScriptIcon = (name) => {
  const n = name.replace("omarchy-", "").toLowerCase();
  if (SCRIPT_ICON_MAP[n]) return SCRIPT_ICON_MAP[n];

  if (n.includes("brightness")) return "hgi-sun-01";
  if (n.includes("theme")) return "hgi-paint-bucket";
  if (n.includes("toggle")) return "hgi-settings-04"; // Using known working icon
  if (n.includes("launch")) return "hgi-rocket";
  if (n.includes("restart")) return "hgi-refresh-01";
  if (n.includes("update")) return "hgi-download-04";
  if (n.includes("monitor") || n.includes("scaling")) return "hgi-view-01";
  if (n.includes("hyprland")) return "hgi-layout-01";
  if (n.includes("system")) return "hgi-computer";
  if (n.includes("menu")) return "hgi-menu-01";
  if (n.includes("hotspot") || n.includes("wifi")) return "hgi-wifi-01";
  if (n.includes("gnirehtet") || n.includes("tether") || n.includes("grient"))
    return "hgi-sharing-01";
  if (n.includes("reverse")) return "hgi-refresh-02";

  return "hgi-settings-04"; // Fallback to a known working icon
};

export default function SystemApps({
  isActive,
  togglesState,
  batteryState,
  themeState,
  powerProfileState,
  remindersState,
}) {
  const [scripts, setScripts] = useState([]);
  const [search, setSearch] = useState("");
  const [executing, setExecuting] = useState(null);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);
  const [toggles, setToggles] = useState({});

  // Premium integration local states
  const [theme, setTheme] = useState({ current: "", available: [] });
  const [powerProfile, setPowerProfile] = useState({ active: "", available: [] });
  const [reminders, setReminders] = useState([]);

  // Synchronize local states
  useEffect(() => {
    if (remindersState) setReminders(remindersState);
  }, [remindersState]);

  // Synchronize local toggles with global SSE stream updates
  useEffect(() => {
    if (togglesState) {
      const mapped = {};
      Object.entries(togglesState).forEach(([key, val]) => {
        mapped[key] = val;
        mapped[`omarchy-${key}`] = val;
      });
      setToggles(mapped);
    }
  }, [togglesState]);

  // Synchronize other states
  useEffect(() => {
    if (themeState) setTheme(themeState);
  }, [themeState]);

  useEffect(() => {
    if (powerProfileState) setPowerProfile(powerProfileState);
  }, [powerProfileState]);

  const handleSetTheme = async (themeName) => {
    setExecuting(`theme-${themeName}`);
    setStatus({ type: "info", message: `applying theme ${themeName}...` });
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "omarchy-theme-set",
          action: "bin",
          args: [themeName],
        }),
      });
      const result = await res.json();
      if (result.success) {
        setStatus({ type: "success", message: `theme ${themeName} applied!` });
      } else {
        setStatus({ type: "error", message: `failed to apply theme: ${result.error}` });
      }
    } catch {
      setStatus({ type: "error", message: "network error." });
    } finally {
      setExecuting(null);
      setTimeout(() => setStatus({ type: null, message: "" }), 5000);
    }
  };

  const handleCycleWallpaper = async () => {
    setExecuting("cycle-wallpaper");
    setStatus({ type: "info", message: "cycling wallpaper..." });
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "omarchy-theme-bg-next",
          action: "bin",
        }),
      });
      const result = await res.json();
      if (result.success) {
        setStatus({ type: "success", message: "wallpaper cycled!" });
      } else {
        setStatus({ type: "error", message: "failed to cycle wallpaper" });
      }
    } catch {
      setStatus({ type: "error", message: "network error." });
    } finally {
      setExecuting(null);
      setTimeout(() => setStatus({ type: null, message: "" }), 5000);
    }
  };

  const handleSetPowerProfile = async (profileName) => {
    setExecuting(`power-profile-${profileName}`);
    setStatus({ type: "info", message: `setting power profile to ${profileName}...` });
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: `powerprofilesctl set ${profileName}`,
          action: "exec",
        }),
      });
      const result = await res.json();
      if (result.success) {
        setStatus({ type: "success", message: `profile set to ${profileName}!` });
      } else {
        setStatus({ type: "error", message: `failed to set profile: ${result.error}` });
      }
    } catch {
      setStatus({ type: "error", message: "network error." });
    } finally {
      setExecuting(null);
      setTimeout(() => setStatus({ type: null, message: "" }), 5000);
    }
  };



  const handleCancelReminder = async (timerName) => {
    setExecuting(`clear-${timerName}`);
    setStatus({ type: "info", message: "canceling reminder..." });
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exec",
          command: `systemctl --user stop ${timerName}`,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setStatus({ type: "success", message: "reminder canceled!" });
      } else {
        setStatus({ type: "error", message: "failed to cancel reminder" });
      }
    } catch {
      setStatus({ type: "error", message: "network error." });
    } finally {
      setExecuting(null);
      setTimeout(() => setStatus({ type: null, message: "" }), 4000);
    }
  };

  const handleClearAllReminders = async () => {
    setExecuting("clear-all-reminders");
    setStatus({ type: "info", message: "clearing all reminders..." });
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bin",
          command: "omarchy-reminder",
          args: ["clear"],
        }),
      });
      const result = await res.json();
      if (result.success) {
        setStatus({ type: "success", message: "all reminders cleared!" });
      } else {
        setStatus({ type: "error", message: "failed to clear reminders" });
      }
    } catch {
      setStatus({ type: "error", message: "network error." });
    } finally {
      setExecuting(null);
      setTimeout(() => setStatus({ type: null, message: "" }), 4000);
    }
  };

  const handleToggle = async (scriptName) => {
    if (executing) return;

    const newState = !toggles[scriptName];
    setToggles((prev) => ({ ...prev, [scriptName]: newState }));

    try {
      await runCommand(scriptName, scriptName);
    } catch (e) {
      // Revert state on execution exception
      setToggles((prev) => ({ ...prev, [scriptName]: !newState }));
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    try {
      const res = await fetch("/api/system");
      const data = await res.json();
      if (Array.isArray(data)) {
        const filtered = data
          .filter((s) => {
            const n = s.name.replace("omarchy-", "");
            const EXCLUDE = [
              "toggle-hybrid-gpu",
              "wifi-powersave",
              "restart-xcompose",
              "launch-or-focus",
              "launch-or-focus-tui",
              "launch-or-focus-webapp",
              "launch-tui",
              "launch-webapp",
              "launch-floating-terminal-with-presentation",
              "webapp-handler-hey",
              "webapp-handler-zoom",
              // interactive theme scripts (need TTY input)
              "theme-install",
              "theme-remove",
              "theme-set",
              "theme-bg-install",
              "theme-bg-set",
              "theme-set-browser",
              "theme-set-gnome",
              "theme-set-obsidian",
              "theme-set-templates",
              "theme-set-vscode",
              "theme-set-keyboard-asus-rog",
              "theme-set-keyboard-f16",
              "swayosd-kbd-brightness",
              "brightness-display-apple",
              "swayosd-brightness",
              "theme-set-keyboard",
              "theme-current",
              "theme-list",
              "theme-refresh",
              "theme-update",
            ];
            return (
              !n.startsWith("cmd-") &&
              !n.startsWith("refresh-") &&
              !n.startsWith("webapp-") &&
              !EXCLUDE.includes(n)
            );
          })
          .map((s) => {
            const isToggle = s.name.startsWith("omarchy-toggle-") || s.name.startsWith("toggle-");
            return { ...s, isToggle };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        // Add virtual commands
        const virtuals = [];

        const finalScripts = [...filtered, ...virtuals];
        setScripts(finalScripts);
      }
    } catch (err) {
      console.error("Failed to fetch scripts", err);
    }
  };

  const runCommand = async (command, name) => {
    const rawLabel = name.replace("omarchy-", "").replace(/-/g, " ");
    // Fix common spelling errors for display
    const cleanName = rawLabel
      .replace(/rverse/g, "reverse")
      .replace(/grient/g, "gnirehtet")
      .trim();

    setExecuting(command);
    setStatus({ type: "info", message: `running ${cleanName}...` });
    try {
      const isSpecial = scripts.find((s) => s.name === name)?.special;
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          action: isSpecial ? "exec" : "bin",
        }),
      });
      const result = await res.json();
      let ok = result.success === true || res.status === 200;

      setStatus({
        type: ok ? "success" : "error",
        message: ok
          ? `${cleanName} done.`
          : `failed: ${result.error || "unknown"}`,
      });
    } catch {
      setStatus({ type: "error", message: "network error." });
    } finally {
      setExecuting(null);
      setTimeout(() => setStatus({ type: null, message: "" }), 5000);
    }
  };

  const categorizedScripts = useMemo(() => {
    const result = {};
    CATEGORIES.forEach((cat) => (result[cat.id] = []));

    scripts.forEach((s) => {
      const n = s.name.replace("omarchy-", "").toLowerCase();
      // Assign to the first category that matches
      const matchedCat = CATEGORIES.find((cat) =>
        cat.keywords.some((k) =>
          k.endsWith("-") ? n.startsWith(k) : n.includes(k),
        ),
      );

      if (matchedCat) {
        if (!search || s.name.toLowerCase().includes(search.toLowerCase())) {
          result[matchedCat.id].push(s);
        }
      }
    });
    return result;
  }, [scripts, search]);

  const searchResults = useMemo(() => {
    if (!search) return [];
    return scripts.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [scripts, search]);

  const visibleScripts = search
    ? searchResults
    : categorizedScripts[activeTab] || [];

  // Split session scripts into primary (big cards) and secondary (small rows)
  const sessionPrimary = useMemo(
    () =>
      (categorizedScripts["session"] || []).filter((s) =>
        SESSION_PRIMARY.includes(s.name.replace("omarchy-", "")),
      ),
    [categorizedScripts],
  );
  const sessionSecondary = useMemo(
    () =>
      (categorizedScripts["session"] || []).filter(
        (s) => !SESSION_PRIMARY.includes(s.name.replace("omarchy-", "")),
      ),
    [categorizedScripts],
  );

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto px-4 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Tab nav */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-1 p-1 bg-gray-100/50 dark:bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded-full flex-wrap justify-center shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveTab(cat.id);
                setSearch("");
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-product-sans font-bold transition-all duration-300 cursor-pointer ${activeTab === cat.id && !search
                ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-700"
                : "text-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              <i className={`hgi hgi-stroke ${cat.icon} text-sm`}></i>
              {cat.name}
              {!search && categorizedScripts[cat.id]?.length > 0 && (
                <span
                  className={`text-[8px] font-mono ${activeTab === cat.id ? "text-accent" : "text-gray-600 dark:text-neutral-600"}`}
                >
                  {categorizedScripts[cat.id].length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Header row */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-gray-600 dark:text-neutral-600 font-product-sans lowercase">
            {search
              ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
              : CATEGORIES.find((c) => c.id === activeTab)?.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {status.message && (
            <div
              className={`px-3 py-1 rounded-full border text-[9px] font-product-sans font-bold flex items-center gap-1.5 animate-in fade-in duration-200 ${status.type === "success"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : status.type === "error"
                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                  : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                }`}
            >
              <span
                className={`w-1 h-1 rounded-full ${status.type === "success" ? "bg-emerald-500" : status.type === "error" ? "bg-red-500" : "bg-blue-500 animate-pulse"}`}
              ></span>
              {status.message}
            </div>
          )}
          {/* Search input */}
          <div className="relative flex items-center">
            <i className="hgi hgi-stroke hgi-search-01 absolute left-3.5 text-gray-600 text-xs pointer-events-none z-10"></i>
            <input
              type="text"
              placeholder="search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border border-gray-200 dark:border-neutral-800 rounded-full pl-9 pr-8 h-9 text-[11px] font-product-sans text-gray-900 dark:text-gray-100 placeholder:text-gray-600/60 focus:outline-none focus:border-accent/30 transition-all w-40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 text-gray-600 hover:text-gray-600 transition-colors"
              >
                <i className="hgi hgi-stroke hgi-cancel-01 text-xs"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── SESSION TAB: Windows-style power layout ── */}
      {activeTab === "session" && !search ? (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Battery & Power Profile HUD */}
          {batteryState && batteryState.hasBattery && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gray-50/50 dark:bg-neutral-900/40 border border-gray-200/80 dark:border-neutral-800/80 rounded-3xl backdrop-blur-md">
              {/* Battery HUD */}
              <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-gray-200/80 dark:border-neutral-800/80 pb-4 md:pb-0 md:pr-4">
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  {/* Battery Circular Progress */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      className="stroke-gray-200 dark:stroke-neutral-800 fill-transparent"
                      strokeWidth="4"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      className={`fill-transparent transition-all duration-1000 ${batteryState.percentage < 20
                        ? "stroke-red-500"
                        : batteryState.percentage < 50
                          ? "stroke-amber-500"
                          : "stroke-emerald-500"
                        }`}
                      strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={2 * Math.PI * 28 * (1 - batteryState.percentage / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-bold font-product-sans text-gray-900 dark:text-gray-100">
                      {batteryState.percentage}%
                    </span>
                    <i className={`hgi hgi-stroke ${batteryState.status === "charging" ? "hgi-flash text-emerald-400" : "hgi-battery-charging text-gray-600"} text-[10px] -mt-0.5`}></i>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 font-product-sans text-sm lowercase">
                      {batteryState.status === "charging" ? "charging" : "discharging"}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-neutral-500 font-product-sans truncate mt-0.5 lowercase">
                    {batteryState.remainingTime ? `${batteryState.remainingTime}` : "calculating..."}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-neutral-600 font-mono mt-1 ">
                    {batteryState.powerRate ? `${batteryState.powerRate}w draw / ${batteryState.capacity}wh` : ""}
                  </p>
                </div>
              </div>

              {/* Power Profile Selector */}
              <div className="flex flex-col justify-center">
                <p className="text-[10px] font-mono text-gray-600 dark:text-neutral-600  st mb-2 px-1">
                  power profile
                </p>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100/50 dark:bg-neutral-900/60 rounded-xl border border-gray-200/50 dark:border-neutral-800/50">
                  {[
                    { id: "power-saver", label: "eco", icon: "hgi-leaf" },
                    { id: "balanced", label: "bal", icon: "hgi-scales" },
                    { id: "performance", label: "perf", icon: "hgi-fire" },
                  ].map((prof) => {
                    const isActive = powerProfile.active === prof.id;
                    const isBusy = executing === `power-profile-${prof.id}`;
                    return (
                      <button
                        key={prof.id}
                        disabled={!!executing}
                        onClick={() => handleSetPowerProfile(prof.id)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all duration-300 cursor-pointer ${isActive
                          ? "bg-white dark:bg-neutral-800 text-accent border border-gray-200/80 dark:border-neutral-700/80"
                          : "text-gray-600 hover:text-gray-600 dark:hover:text-gray-300"
                          }`}
                      >
                        {isBusy ? (
                          <div className="w-3.5 h-3.5 border border-t-transparent border-accent rounded-full animate-spin"></div>
                        ) : (
                          <i className={`hgi hgi-stroke ${prof.icon} text-sm mb-0.5`}></i>
                        )}
                        <span className="text-[9px] font-product-sans font-bold lowercase r">
                          {prof.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Active Reminders HUD */}
          <div className="flex flex-col gap-4 p-5 bg-gray-50/50 dark:bg-neutral-900/40 border border-gray-200/80 dark:border-neutral-800/80 rounded-3xl backdrop-blur-md">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <i className="hgi hgi-stroke hgi-alarm-clock text-gray-600 text-lg"></i>
                <h4 className="font-bold text-gray-900 dark:text-gray-100 font-product-sans text-sm lowercase">
                  active reminders
                </h4>
              </div>
              {reminders.length > 0 && (
                <button
                  disabled={!!executing}
                  onClick={handleClearAllReminders}
                  className="cursor-pointer text-[10px] font-product-sans font-bold text-red-500 hover:text-red-400 transition-colors  border border-red-500/10 hover:border-red-500/30 px-3 py-1 rounded-full bg-red-500/5 hover:bg-red-500/10 flex items-center gap-1"
                >
                  <i className="hgi hgi-stroke hgi-delete-02 text-[10px]"></i>
                  clear all
                </button>
              )}
            </div>

            {reminders.length === 0 ? (
              <p className="text-xs text-gray-600 dark:text-neutral-500 font-product-sans px-1 lowercase">
                no active reminders. set one with <code className="bg-gray-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px]">$reminder</code>
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {reminders.map((rem) => {
                  const busy = executing === `clear-${rem.timer}`;
                  return (
                    <div
                      key={rem.timer}
                      className="flex items-center justify-between p-3 bg-white/50 dark:bg-neutral-950/20 border border-gray-150 dark:border-neutral-850 rounded-2xl"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-accent/5 border border-accent/15 flex items-center justify-center text-accent shrink-0">
                          <i className="hgi hgi-stroke hgi-alarm-clock text-sm"></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100 font-product-sans truncate lowercase">
                            {rem.message}
                          </p>
                          <p className="text-[10px] text-gray-600 dark:text-neutral-500 font-product-sans mt-0.5 lowercase">
                            {rem.minutes}-min reminder set at {new Date(rem.set_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-xs font-bold font-mono text-accent bg-accent/5 border border-accent/10 px-2.5 py-1 rounded-full">
                          {Math.ceil(rem.remaining / 60)}m left
                        </span>
                        <button
                          disabled={!!executing}
                          onClick={() => handleCancelReminder(rem.timer)}
                          className="cursor-pointer p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                          title="cancel reminder"
                        >
                          {busy ? (
                            <div className="w-3.5 h-3.5 border-2 border-t-transparent border-red-500 rounded-full animate-spin"></div>
                          ) : (
                            <i className="hgi hgi-stroke hgi-cancel-01 text-sm"></i>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* Primary power buttons — big icon cards */}
          <div className="grid grid-cols-4 gap-3">
            {sessionPrimary.map((script) => {
              const key = script.name.replace("omarchy-", "");
              const meta = SESSION_META[key] || {
                icon: "hgi-power",
                label: key,
                color: "neutral",
              };
              const c = COLOR_MAP[meta.color];
              const busy = executing === script.name;
              return (
                <button
                  key={script.name}
                  onClick={() =>
                    !executing && runCommand(script.name, script.name)
                  }
                  disabled={!!executing}
                  className={`group flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border transition-all duration-300 cursor-pointer
                                        ${busy ? c.busy : `${c.bg} ${c.border} ${c.hover}`}
                                        ${executing && !busy ? "opacity-30 pointer-events-none" : ""}
                                    `}
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${busy ? "bg-white/10" : "bg-white/50 dark:bg-white/5"}`}
                  >
                    {busy ? (
                      <div
                        className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${c.icon}`}
                      ></div>
                    ) : (
                      <i
                        className={`hgi hgi-stroke ${getScriptIcon(script.name)} text-xl ${c.icon} transition-colors`}
                      ></i>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-product-sans font-bold lowercase  ${busy ? c.icon : "text-gray-600 dark:text-gray-400 group-hover:" + c.icon.split(" ")[0]}`}
                  >
                    {meta.label.toLowerCase()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secondary items — compact flat rows */}
          {sessionSecondary.length > 0 && (
            <div className="flex flex-col gap-0 border-t border-gray-100 dark:border-neutral-900 pt-2">
              <p className="text-[10px] font-mono text-gray-500 dark:text-neutral-700  st mb-2 px-1">
                more
              </p>
              {sessionSecondary.map((script) => {
                const rawLabel = script.name
                  .replace("omarchy-", "")
                  .replace(/-/g, " ");
                const cleanLabel = rawLabel
                  .replace(/rverse/g, "reverse")
                  .replace(/grient/g, "gnirehtet")
                  .trim();

                const action = script.isToggle
                  ? "toggle"
                  : script.name.replace("omarchy-", "").split("-")[0] || "run";
                const tail =
                  cleanLabel.replace(action, "").trim() || cleanLabel;
                const busy = executing === script.name;
                return (
                  <div
                    key={script.name}
                    onClick={() =>
                      !executing &&
                      (action === "toggle"
                        ? handleToggle(script.name)
                        : runCommand(script.name, script.name))
                    }
                    className={`group cursor-pointer relative flex items-center gap-4 p-4 bg-transparent border-b border-gray-100 dark:border-neutral-900 transition-all duration-300 hover:bg-gray-50/30 dark:hover:bg-white/[0.01] ${executing && !busy ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${busy ? "bg-accent/10" : "bg-gray-50 dark:bg-neutral-900/50 group-hover:bg-accent/5"}`}
                    >
                      {busy ? (
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <i
                          className={`hgi hgi-stroke ${getScriptIcon(script.name)} text-gray-600 dark:text-neutral-600 group-hover:text-accent text-lg transition-colors`}
                        ></i>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 font-product-sans truncate text-sm lowercase">
                          {tail}
                        </h3>
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-product-sans font-bold bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-600 border border-gray-200/50 dark:border-neutral-800/50 ">
                          {action}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-neutral-600 font-product-sans truncate font-mono mt-0.5">
                        {script.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {action === "toggle" ? (
                        <div
                          className="flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleToggle(script.name)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-500 focus:outline-none cursor-pointer ${toggles[script.name]
                              ? "bg-accent"
                              : "bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700"
                              }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-neutral-300 transition-all duration-500 ${toggles[script.name]
                                ? "translate-x-4.5 bg-white"
                                : "translate-x-0.5"
                                }`}
                            />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-neutral-700 font-product-sans  opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                            {Math.round((script.size / 1024) * 10) / 10 || "<1"}
                            k
                          </span>
                          <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button className="inline-flex items-center gap-2 px-4 py-1.5 text-[10px] font-product-sans font-bold text-gray-700 dark:text-gray-300 hover:text-accent hover:bg-accent/10 rounded-full transition-all duration-300 border border-gray-200 dark:border-neutral-800 hover:border-accent/30 ">
                              <i className="hgi hgi-stroke hgi-play text-xs"></i>
                              run
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // ── ALL OTHER TABS ──
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">


          {/* Theme Manager Widget (renders inside system tab) */}
          {activeTab === "system" && themeState && !search && (
            <div className="flex flex-col gap-4 p-5 bg-gray-50/50 dark:bg-neutral-900/40 border border-gray-200/80 dark:border-neutral-800/80 rounded-3xl backdrop-blur-md animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <i className="hgi hgi-stroke hgi-paint-board text-gray-600 text-lg"></i>
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 font-product-sans text-sm lowercase">
                    system themes
                  </h4>
                </div>
                <button
                  disabled={!!executing}
                  onClick={handleCycleWallpaper}
                  className="cursor-pointer text-[10px] font-product-sans font-bold text-accent hover:text-accent/90 transition-colors  border border-accent/10 hover:border-accent/30 px-3 py-1 rounded-full bg-accent/5 hover:bg-accent/10 flex items-center gap-1.5"
                >
                  {executing === "cycle-wallpaper" ? (
                    <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <i className="hgi hgi-stroke hgi-image-02 text-[10px]"></i>
                  )}
                  cycle wallpaper
                </button>
              </div>

              {/* Current theme HUD */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/80 dark:bg-neutral-950/40 border border-gray-200/50 dark:border-neutral-800/50">
                <div className="w-10 h-10 rounded-full bg-accent/5 border border-accent/15 flex items-center justify-center text-accent">
                  <i className="hgi hgi-stroke hgi-magic-wand text-lg"></i>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-gray-600 dark:text-neutral-600  st">
                    active desktop skin
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 font-product-sans lowercase mt-0.5">
                    {theme.current || "unknown"}
                  </p>
                </div>
              </div>

              {/* Available Theme Pills */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-mono text-gray-600 dark:text-neutral-600  st px-1">
                  available profiles
                </p>
                <div className="flex gap-2 flex-wrap max-h-36 overflow-y-auto pr-1">
                  {theme.available.map((t) => {
                    const isActive = theme.current.toLowerCase() === t.toLowerCase() ||
                      theme.current.toLowerCase().replace(/\s+/g, '-') === t.toLowerCase();
                    const isBusy = executing === `theme-${t}`;
                    return (
                      <button
                        key={t}
                        disabled={!!executing}
                        onClick={() => handleSetTheme(t)}
                        className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-product-sans font-bold border transition-all duration-300 flex items-center gap-1.5 ${isActive
                          ? "bg-accent text-white border-accent"
                          : "border-gray-200 dark:border-neutral-800/80 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-neutral-700 bg-white/40 dark:bg-neutral-950/10"
                          }`}
                      >
                        {isBusy ? (
                          <div className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${isActive ? "border-white" : "border-accent"}`}></div>
                        ) : (
                          <i className={`hgi hgi-stroke hgi-t-shirt-01 text-[11px] ${isActive ? "text-white" : "text-gray-600 dark:text-neutral-500"}`}></i>
                        )}
                        <span>{t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Quick Screenshots / Recording Widget (renders inside display tab) */}
          {activeTab === "display" && !search && (
            <div className="flex flex-col gap-4 p-5 bg-gray-50/50 dark:bg-neutral-900/40 border border-gray-200/80 dark:border-neutral-800/80 rounded-3xl backdrop-blur-md animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <i className="hgi hgi-stroke hgi-camera text-gray-600 text-lg"></i>
                <h4 className="font-bold text-gray-900 dark:text-gray-100 font-product-sans text-sm lowercase">
                  screen capture & tools
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    id: "screenshot",
                    label: "screenshot",
                    icon: "hgi-camera-01",
                    cmd: "omarchy-capture-screenshot fullscreen save",
                    desc: "fullscreen snapshot"
                  },
                  {
                    id: "screenrecord",
                    label: "record screen",
                    icon: "hgi-video-recorder",
                    cmd: "omarchy-capture-screenrecording",
                    desc: "launch recorder"
                  },
                  {
                    id: "ocr",
                    label: "ocr text",
                    icon: "hgi-align-justify",
                    cmd: "omarchy-capture-text-extraction",
                    desc: "extract from region"
                  }
                ].map((tool) => {
                  const isBusy = executing === tool.id;
                  return (
                    <button
                      key={tool.id}
                      disabled={!!executing}
                      onClick={() => runCommand(tool.cmd, tool.id)}
                      className="cursor-pointer group flex flex-col items-center justify-center p-4 rounded-2xl bg-white/40 dark:bg-neutral-950/10 border border-gray-200/50 dark:border-neutral-800/50 hover:bg-white dark:hover:bg-neutral-950/30 hover:border-accent/20 transition-all duration-300"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-neutral-900/50 group-hover:bg-accent/5 group-hover:text-accent mb-2.5 transition-colors`}>
                        {isBusy ? (
                          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <i className={`hgi hgi-stroke ${tool.icon} text-lg text-gray-600 dark:text-neutral-500 group-hover:text-accent`}></i>
                        )}
                      </div>
                      <span className="text-[11px] font-product-sans font-bold text-gray-900 dark:text-gray-100 lowercase">
                        {tool.label}
                      </span>
                      <span className="text-[8px] font-product-sans text-gray-600 mt-0.5 text-center leading-none">
                        {tool.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* List of flat rows */}
          <div className="flex flex-col gap-0 border-b border-gray-100 dark:border-neutral-900">
            {visibleScripts.length > 0 ? (
              visibleScripts.map((script) => {
                const rawLabel = script.name
                  .replace("omarchy-", "")
                  .replace(/-/g, " ");
                const cleanLabel = rawLabel
                  .replace(/rverse/g, "reverse")
                  .replace(/grient/g, "gnirehtet")
                  .trim();

                const action = script.isToggle
                  ? "toggle"
                  : script.name.replace("omarchy-", "").split("-")[0] || "run";
                const tail = cleanLabel.replace(action, "").trim() || cleanLabel;
                const busy = executing === script.name;

                return (
                  <div
                    key={script.name}
                    onClick={() =>
                      !executing &&
                      (action === "toggle"
                        ? handleToggle(script.name)
                        : runCommand(script.name, script.name))
                    }
                    className={`group cursor-pointer relative flex items-center gap-4 p-4 bg-transparent border-b border-gray-100 dark:border-neutral-900 transition-all duration-300 hover:bg-gray-50/30 dark:hover:bg-white/[0.01] ${executing && !busy ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${busy
                        ? "bg-accent/10"
                        : "bg-gray-50 dark:bg-neutral-900/50 group-hover:bg-accent/5"
                        }`}
                    >
                      {busy ? (
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <i
                          className={`hgi hgi-stroke ${getScriptIcon(script.name)} text-gray-600 dark:text-neutral-600 group-hover:text-accent text-lg transition-colors`}
                        ></i>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 font-product-sans truncate text-sm lowercase">
                          {tail}
                        </h3>
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-product-sans font-bold bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-600 border border-gray-200/50 dark:border-neutral-800/50 ">
                          {action}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-neutral-600 font-product-sans truncate font-mono mt-0.5">
                        {script.name}
                      </p>
                    </div>

                    {/* Right — run hint on hover */}
                    <div className="flex items-center gap-2">
                      {action === "toggle" ? (
                        <div
                          className="flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleToggle(script.name)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-500 focus:outline-none cursor-pointer ${toggles[script.name]
                              ? "bg-accent"
                              : "bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700"
                              }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full transition-all duration-500 ${toggles[script.name]
                                ? "translate-x-4.5 bg-white"
                                : "translate-x-0.5 bg-white dark:bg-neutral-300"
                                }`}
                            />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-neutral-700 font-product-sans  opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                            {Math.round((script.size / 1024) * 10) / 10 || "<1"}k
                          </span>
                          <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button className="inline-flex items-center gap-2 px-4 py-1.5 text-[10px] font-product-sans font-bold text-gray-700 dark:text-gray-300 hover:text-accent hover:bg-accent/10 rounded-full transition-all duration-300 border border-gray-200 dark:border-neutral-800 hover:border-accent/30 ">
                              <i className="hgi hgi-stroke hgi-play text-xs"></i>
                              run
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-gray-100 dark:border-neutral-900 rounded-[32px]">
                <p className="text-sm text-gray-600 font-product-sans">
                  {search
                    ? `no commands match "${search}"`
                    : "no scripts in this category"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
