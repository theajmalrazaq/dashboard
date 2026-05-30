import { useEffect, useState } from "react";
import { onSyncStatusChange, getSyncStatus, performSync } from "../../lib/offline/sync";

export default function OfflineIndicator() {
  const [status, setStatus] = useState(getSyncStatus());

  useEffect(() => {
    const unsubscribe = onSyncStatusChange(setStatus);
    return unsubscribe;
  }, []);

  if (status.isOnline && status.queueLength === 0) {
    return null; // No indicator when fully synced and online
  }

  const handleSync = async () => {
    await performSync();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium transition-all ${
          !status.isOnline
            ? "bg-red-500/10 text-red-500 border-red-500/20"
            : status.queueLength > 0
              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        }`}
      >
        {!status.isOnline ? (
          <>
            <i className="hgi hgi-stroke hgi-wifi-off-01 text-sm"></i>
            <span>Offline</span>
            {status.queueLength > 0 && (
              <span className="ml-1 bg-red-500/20 px-2 py-0.5 rounded-full text-xs">
                {status.queueLength} pending
              </span>
            )}
          </>
        ) : status.queueLength > 0 ? (
          <>
            <i
              className={`hgi hgi-stroke hgi-loading-03 text-sm ${
                status.isSyncing ? "animate-spin" : ""
              }`}
            ></i>
            <span>
              {status.isSyncing ? "Syncing..." : `${status.queueLength} pending`}
            </span>
            {!status.isSyncing && (
              <button
                type="button"
                onClick={handleSync}
                className="ml-2 hover:opacity-80 transition-opacity"
                title="Sync now"
              >
                <i className="hgi hgi-stroke hgi-refresh-cw-04 text-sm"></i>
              </button>
            )}
          </>
        ) : (
          <>
            <i className="hgi hgi-stroke hgi-wifi-01 text-sm"></i>
            <span>Synced</span>
          </>
        )}
      </div>
    </div>
  );
}
