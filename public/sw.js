const CACHE_NAME = 'ligtaslto-cache-v1';
const PENDING_SUBMISSIONS_KEY = 'ligtaslto_pending_submissions';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through for normal requests
  // Complex caching can go here
});

// SCENARIO 1: BACKGROUND SYNC
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-submissions') {
    event.waitUntil(flushPendingSubmissions());
  }
});

async function flushPendingSubmissions() {
  const allClients = await clients.matchAll({ includeUncontrolled: true });
  try {
    // Note: In a real implementation using IndexedDB is better because localStorage isn't available in SW.
    // However, since we're using Service Worker, we'll communicate with the client to do the submission or use IndexedDB.
    // Assuming the main window handles IndexedDB or localforage to store data.
    // We will broadcast a message to the active clients to flush their localStorage queue.
    for (const client of allClients) {
      client.postMessage({ type: 'FLUSH_DUE_TO_SYNC' });
    }
  } catch (err) {
    console.error('Background sync failed:', err);
  }
}
