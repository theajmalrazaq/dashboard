// IndexedDB schema and utilities for offline storage

export interface OfflinePost {
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
  synced: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SyncQueue {
  id: string;
  type: "create" | "update" | "delete";
  table: "posts" | "notes" | "links";
  data: any;
  timestamp: number;
  synced: boolean;
}

const DB_NAME = "OmarchyDashboard";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create posts store
      if (!database.objectStoreNames.contains("posts")) {
        const postStore = database.createObjectStore("posts", {
          keyPath: "id",
        });
        postStore.createIndex("synced", "synced", { unique: false });
        postStore.createIndex("date", "date", { unique: false });
      }

      // Create notes store
      if (!database.objectStoreNames.contains("notes")) {
        const noteStore = database.createObjectStore("notes", {
          keyPath: "id",
        });
        noteStore.createIndex("synced", "synced", { unique: false });
        noteStore.createIndex("date", "date", { unique: false });
      }

      // Create links store
      if (!database.objectStoreNames.contains("links")) {
        const linkStore = database.createObjectStore("links", {
          keyPath: "id",
        });
        linkStore.createIndex("synced", "synced", { unique: false });
      }

      // Create sync queue store
      if (!database.objectStoreNames.contains("syncQueue")) {
        const queueStore = database.createObjectStore("syncQueue", {
          keyPath: "id",
          autoIncrement: true,
        });
        queueStore.createIndex("synced", "synced", { unique: false });
        queueStore.createIndex("table", "table", { unique: false });
      }
    };
  });
}

export async function getDB(): Promise<IDBDatabase> {
  if (db) return db;
  return initDB();
}

export async function savePosts(posts: OfflinePost[]): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction(["posts"], "readwrite");
  const store = transaction.objectStore("posts");

  return new Promise((resolve, reject) => {
    posts.forEach((post) => {
      store.put(post);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getPosts(): Promise<OfflinePost[]> {
  const database = await getDB();
  const transaction = database.transaction(["posts"], "readonly");
  const store = transaction.objectStore("posts");

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePost(post: OfflinePost): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction(["posts"], "readwrite");
  const store = transaction.objectStore("posts");

  return new Promise((resolve, reject) => {
    const request = store.put(post);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPost(id: string): Promise<OfflinePost | undefined> {
  const database = await getDB();
  const transaction = database.transaction(["posts"], "readonly");
  const store = transaction.objectStore("posts");

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePost(id: string): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction(["posts"], "readwrite");
  const store = transaction.objectStore("posts");

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function addToSyncQueue(
  type: "create" | "update" | "delete",
  table: "posts" | "notes" | "links",
  data: any,
): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction(["syncQueue"], "readwrite");
  const store = transaction.objectStore("syncQueue");

  const queueItem: Omit<SyncQueue, "id"> = {
    type,
    table,
    data,
    timestamp: Date.now(),
    synced: false,
  };

  return new Promise((resolve, reject) => {
    const request = store.add(queueItem);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncQueue(): Promise<SyncQueue[]> {
  const database = await getDB();
  const transaction = database.transaction(["syncQueue"], "readonly");
  const store = transaction.objectStore("syncQueue");
  const index = store.index("synced");

  return new Promise((resolve, reject) => {
    const request = index.getAll(false);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function markSyncQueueItemAsSynced(id: number): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction(["syncQueue"], "readwrite");
  const store = transaction.objectStore("syncQueue");

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result;
      if (item) {
        item.synced = true;
        store.put(item);
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearSyncQueue(): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction(["syncQueue"], "readwrite");
  const store = transaction.objectStore("syncQueue");

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
