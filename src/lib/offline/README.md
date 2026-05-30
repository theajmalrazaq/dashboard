# 📱 Offline Sync Feature

## Overview

The dashboard now supports **offline-first functionality** for notes, blogs, and other content. Users can:

- ✍️ **Write & Edit** posts, notes, and links while offline
- 💾 **Auto-save** to local IndexedDB storage
- 🔄 **Auto-sync** when connection is restored
- 📊 **Track sync status** with visual indicator
- ⏳ **Queue operations** for batch syncing

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│      User Actions (Create/Update)       │
└────────────────┬────────────────────────┘
                 │
         ┌───────▼──────────┐
         │  Online Check?   │
         └───┬──────────┬───┘
             │          │
          YES│          │NO
             │          │
    ┌────────▼──┐    ┌──▼────────────┐
    │ Supabase  │    │  Queue + Save │
    │  (Cloud)  │    │ to IndexedDB  │
    └───────────┘    └───────────────┘
             │               │
             └───────┬───────┘
                     │
         ┌───────────▼──────────────┐
         │   Cache to IndexedDB     │
         └────────────────────────────┘
                     │
    ┌────────────────▼─────────────────┐
    │   Network Restored Event         │
    │   Auto-sync Queue Items          │
    └─────────────────────────────────┘
```

### Storage Layers

1. **IndexedDB** (Local, Persistent)
   - Stores posts, notes, links
   - Indexed by `synced` status and date
   - Survives browser restart
   - ~50MB quota per origin

2. **Sync Queue** (IndexedDB)
   - Queues pending operations (create/update/delete)
   - Tracks sync status per item
   - Automatically processed when online

3. **Supabase** (Cloud, Remote)
   - Source of truth when online
   - Synced in batch after connection restored

## Usage

### For Users

**Writing a Post Offline:**
1. Open "blog" tab
2. Click "new post"
3. Write content normally
4. Click "save"
5. See "Saved offline, will sync when online" message
6. Changes are queued automatically

**Offline Indicator:**
- Bottom-right corner shows sync status
- 🌐 **Synced** - All changes synced, online
- 📶 **Offline** - No internet connection, changes queued
- ⏳ **Syncing...** - Currently syncing pending changes
- **Manual Sync** - Click refresh icon to sync now

### For Developers

#### Initialize Offline Sync

```typescript
import { initOfflineSync } from "@/lib/offline/sync";

// In your app initialization
useEffect(() => {
  initOfflineSync();
}, []);
```

#### Get Posts with Offline Fallback

```typescript
import { getPostsWithOfflineFallback } from "@/lib/offline/sync";

const posts = await getPostsWithOfflineFallback();
// Returns cloud posts if online, cached posts if offline
```

#### Queue Operations

```typescript
import {
  queuePostCreate,
  queuePostUpdate,
  queuePostDelete,
} from "@/lib/offline/sync";

// Create offline
const newPost = {
  id: "temp-id",
  title: "My Post",
  slug: "my-post",
  content: "...",
  synced: false,
  // ... other fields
};
await queuePostCreate(newPost);

// Update offline
await queuePostUpdate(updatedPost);

// Delete offline
await queuePostDelete(postId);
```

#### Monitor Sync Status

```typescript
import { onSyncStatusChange, getSyncStatus } from "@/lib/offline/sync";

// Get current status
const status = getSyncStatus();
console.log(status);
// { isOnline: boolean, isSyncing: boolean, queueLength: number, lastSyncTime?: number }

// Listen for changes
const unsubscribe = onSyncStatusChange((status) => {
  console.log("Sync status changed:", status);
});

// Clean up
unsubscribe();
```

#### Trigger Manual Sync

```typescript
import { performSync } from "@/lib/offline/sync";

const success = await performSync();
// Returns true if sync completed, false if offline or already syncing
```

## Database Schema

### Posts Store
```typescript
interface OfflinePost {
  id: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  social_image?: string;
  keywords?: string[];
  read_time: number;
  is_published: boolean;
  date: string;
  synced: boolean; // Track if synced to cloud
  created_at?: string;
  updated_at?: string;
}
```

### Sync Queue
```typescript
interface SyncQueue {
  id: string;
  type: "create" | "update" | "delete";
  table: "posts" | "notes" | "links";
  data: any;
  timestamp: number;
  synced: boolean;
}
```

## Conflict Resolution

When syncing, the system uses **last-write-wins**:
- If both local and cloud have changes, cloud version takes precedence
- User can edit again to reapply local changes if needed
- Future: Add conflict detection and manual resolution UI

## Browser Compatibility

- ✅ Chrome 24+
- ✅ Firefox 10+
- ✅ Safari 10+
- ✅ Edge 79+
- ⚠️ IE not supported

## Storage Limits

- **IndexedDB quota**: ~50MB per origin (Chrome/Firefox)
- **Sync queue**: Can handle ~1000 pending items
- **Post storage**: ~500 posts at full metadata

## Troubleshooting

### Posts not syncing?

1. Check offline indicator status
2. Open DevTools → Application → IndexedDB → OmarchyDashboard
3. Check `syncQueue` for pending items
4. Click refresh on offline indicator to retry

### Lost posts?

1. Check IndexedDB in DevTools
2. Posts should persist even after browser close
3. If cleared, check browser storage settings

### Sync stuck?

1. Hard refresh page (Ctrl+Shift+R)
2. Click sync button on offline indicator
3. Check browser console for errors

## Future Enhancements

- [ ] Conflict detection and UI for manual resolution
- [ ] Encryption for sensitive data
- [ ] Service Worker for true offline mode
- [ ] Delta sync (only changed fields)
- [ ] Bulk export/import of offline data
- [ ] Automatic cleanup of old cached data
