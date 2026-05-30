// Offline sync manager
import type { OfflinePost, SyncQueue } from "./db";
import {
  getSyncQueue,
  markSyncQueueItemAsSynced,
  addToSyncQueue,
  savePosts,
  getPosts,
  savePost,
} from "./db";
import { supabase } from "../supabase";

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queueLength: number;
  lastSyncTime?: number;
}

const syncStatus: SyncStatus = {
  isOnline: typeof window !== "undefined" && navigator.onLine,
  isSyncing: false,
  queueLength: 0,
};

const syncListeners = new Set<(status: SyncStatus) => void>();

export function onSyncStatusChange(
  callback: (status: SyncStatus) => void,
): () => void {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function notifySyncStatusChange() {
  syncListeners.forEach((cb) => {
    cb(syncStatus);
  });
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

export async function initOfflineSync() {
  if (typeof window === "undefined") return;

  // Listen for online/offline events
  window.addEventListener("online", () => {
    syncStatus.isOnline = true;
    notifySyncStatusChange();
    performSync(); // Sync when coming back online
  });

  window.addEventListener("offline", () => {
    syncStatus.isOnline = false;
    notifySyncStatusChange();
  });

  // Initial sync attempt
  await performSync();
}

export async function performSync(): Promise<boolean> {
  if (!syncStatus.isOnline || syncStatus.isSyncing) return false;

  syncStatus.isSyncing = true;
  notifySyncStatusChange();

  try {
    const queue = await getSyncQueue();
    syncStatus.queueLength = queue.length;

    if (queue.length === 0) {
      syncStatus.isSyncing = false;
      syncStatus.lastSyncTime = Date.now();
      notifySyncStatusChange();
      return true;
    }

    // Process each item in the queue
    for (const item of queue) {
      await syncQueueItem(item);
    }

    syncStatus.lastSyncTime = Date.now();
    syncStatus.queueLength = 0;
    syncStatus.isSyncing = false;
    notifySyncStatusChange();
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    syncStatus.isSyncing = false;
    notifySyncStatusChange();
    return false;
  }
}

async function syncQueueItem(item: SyncQueue): Promise<void> {
  try {
    if (item.table === "posts") {
      await syncPost(item.type, item.data);
    } else if (item.table === "notes") {
      await syncNote(item.type, item.data);
    } else if (item.table === "links") {
      await syncLink(item.type, item.data);
    }

    // Mark as synced
    const id = parseInt(item.id as string);
    await markSyncQueueItemAsSynced(id);
  } catch (error) {
    console.error("Failed to sync item:", item, error);
    throw error;
  }
}

async function syncPost(
  type: "create" | "update" | "delete",
  data: OfflinePost,
): Promise<void> {
  const { id, ...postData } = data;

  if (type === "create") {
    const { error } = await supabase.from("posts").insert([postData]);
    if (error) throw error;
  } else if (type === "update") {
    const { error } = await supabase
      .from("posts")
      .update(postData)
      .eq("id", id);
    if (error) throw error;

    // Mark as synced in local DB
    await savePost({ ...data, synced: true });
  } else if (type === "delete") {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) throw error;
  }
}

async function syncNote(
  type: "create" | "update" | "delete",
  data: Record<string, unknown>,
): Promise<void> {
  const { id, ...noteData } = data as Record<string, unknown> & { id: string };

  if (type === "create") {
    const { error } = await supabase.from("notes").insert([noteData]);
    if (error) throw error;
  } else if (type === "update") {
    const { error } = await supabase
      .from("notes")
      .update(noteData)
      .eq("id", id);
    if (error) throw error;
  } else if (type === "delete") {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) throw error;
  }
}

async function syncLink(
  type: "create" | "update" | "delete",
  data: Record<string, unknown>,
): Promise<void> {
  const { id, ...linkData } = data as Record<string, unknown> & { id: string };

  if (type === "create") {
    const { error } = await supabase.from("links").insert([linkData]);
    if (error) throw error;
  } else if (type === "update") {
    const { error } = await supabase
      .from("links")
      .update(linkData)
      .eq("id", id);
    if (error) throw error;
  } else if (type === "delete") {
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) throw error;
  }
}

// Helper functions to queue operations offline

export async function queuePostCreate(post: OfflinePost): Promise<void> {
  // Save to local DB immediately
  await savePost({ ...post, synced: false });

  // Add to sync queue
  if (!syncStatus.isOnline) {
    await addToSyncQueue("create", "posts", post);
  }
}

export async function queuePostUpdate(post: OfflinePost): Promise<void> {
  // Save to local DB immediately
  await savePost({ ...post, synced: false });

  // Add to sync queue
  if (!syncStatus.isOnline) {
    await addToSyncQueue("update", "posts", post);
  }
}

export async function queuePostDelete(id: string): Promise<void> {
  // Add to sync queue
  if (!syncStatus.isOnline) {
    await addToSyncQueue("delete", "posts", { id });
  }
}

// Get posts with offline fallback
export async function getPostsWithOfflineFallback(): Promise<OfflinePost[]> {
  if (syncStatus.isOnline) {
    try {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .order("date", { ascending: false });
      if (data) {
        // Cache to offline storage
        await savePosts(
          data.map(
            (post: Record<string, unknown>) =>
              ({ ...post, synced: true }) as OfflinePost,
          ),
        );
        return data as OfflinePost[];
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  }

  // Fallback to offline cache
  return getPosts();
}

// Get single post with offline fallback
export async function getPostWithOfflineFallback(
  id: string,
): Promise<OfflinePost | null> {
  if (syncStatus.isOnline) {
    try {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        // Cache to offline storage
        await savePost({ ...data, synced: true } as OfflinePost);
        return data as OfflinePost;
      }
    } catch (error) {
      console.error("Error fetching post:", error);
    }
  }

  // Fallback to offline cache
  const offlinePost = await getPosts();
  return offlinePost.find((p) => p.id === id) || null;
}
