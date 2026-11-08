const CACHE_NAME = 'dana-vip-v6.0-cloud';
const DEFAULT_FIREBASE_DB_URL = 'https://officialdana-vip-default-rtdb.asia-southeast1.firebasedatabase.app';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/cloud_config.json',
  '/manifest.json',
  '/app_icon_192.png',
  '/app_icon_512.png',
  '/reset_icon.png'
];

let swFirebaseUrl = DEFAULT_FIREBASE_DB_URL;
let swIsVipValid = true;
let swLastSeenAlertId = '';
let swCloudWatchTimer = null;

function startSwBackgroundCloudWatcher() {
  if (swCloudWatchTimer) return;
  swCloudWatchTimer = setInterval(() => {
    if (!swIsVipValid || !swFirebaseUrl) return;
    fetch(swFirebaseUrl + '/dana_live_hub/lastAlertEvent.json?t=' + Date.now())
      .then((res) => (res.ok ? res.json() : null))
      .then((alertObj) => {
        if (!alertObj || !alertObj.id) return;
        if (alertObj.id === swLastSeenAlertId) return;
        if (alertObj.timestamp && Date.now() - alertObj.timestamp > 90000) {
          swLastSeenAlertId = alertObj.id;
          return;
        }
        swLastSeenAlertId = alertObj.id;
        self.registration.showNotification(alertObj.title || '⚡ Official DANA VIP Live Signal', {
          body: alertObj.body || 'නව සජීවී සංඥාවක් නිකුත් විය!',
          icon: '/app_icon_192.png',
          badge: '/app_icon_192.png',
          vibrate: [300, 120, 300, 120, 400],
          tag: alertObj.id,
          renotify: true,
          requireInteraction: true,
          data: { url: '/#live' },
          actions: [
            { action: 'open', title: 'විවෘත කරන්න ➔' },
            { action: 'close', title: 'වසන්න' }
          ]
        });
      })
      .catch(() => {});
  }, 4000);
}

// Install Event - Pre-cache core shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  startSwBackgroundCloudWatcher();
});

// Activate Event - Clean old caches & auto-update immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
  startSwBackgroundCloudWatcher();
});

// Fetch Event - Network First with Cache Fallback (Guarantees Instant Updates!)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Never cache Firebase Realtime Database calls
  if (event.request.url.includes('firebasedatabase.app') || event.request.url.includes('firebaseio.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Web Push Notification Listener (For Real-time Live Signals)
self.addEventListener('push', (event) => {
  let data = {
    title: '⚡ Official DANA VIP Live Signal',
    body: 'නිරවද්‍ය Live Signal එකක් සූදානම්! දැන්ම පරීක්ෂා කරන්න.',
    icon: '/app_icon_192.png',
    badge: '/app_icon_192.png',
    url: '/'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/app_icon_192.png',
    badge: data.badge || '/app_icon_192.png',
    vibrate: [300, 120, 300, 120, 400],
    renotify: true,
    requireInteraction: true,
    tag: 'dana-push-' + Date.now(),
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'විවෘත කරන්න ➔' },
      { action: 'close', title: 'වසන්න' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Message Listener from App (Sync VIP status, Firebase URL, and Immediate Notifications)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SYNC_VIP_CLOUD_WATCHER') {
    if (event.data.firebaseDbUrl) swFirebaseUrl = event.data.firebaseDbUrl;
    if (typeof event.data.isVipValid === 'boolean') swIsVipValid = event.data.isVipValid;
    if (event.data.lastSeenAlertId) swLastSeenAlertId = event.data.lastSeenAlertId;
    startSwBackgroundCloudWatcher();
  } else if (event.data.type === 'TRIGGER_DAILY_VIP_NOTIFICATION') {
    self.registration.showNotification('🔑 අද දවසේ VIP Password ලබාගන්න', {
      body: 'Official Agent DANA වෙතින් අද දවසේ VIP Passwords සහ Deposit/Withdrawal තොරතුරු ලබාගැනීමට WhatsApp වෙත පිවිසෙන්න.',
      icon: '/app_icon_192.png',
      badge: '/app_icon_192.png',
      vibrate: [300, 150, 300],
      data: { url: 'https://wa.me/94742517405' },
      tag: 'daily-vip-pw-8am'
    });
  }
});
