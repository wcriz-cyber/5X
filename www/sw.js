'use strict';
// ════════════════════════════════════════════════════════════════
//  5X — Service Worker v4  (Capacitor / GitHub Pages / PWA)
//  FIX: URLs absolutas via scope, openWindow con ruta correcta,
//       badge monocromo, timestamp, y canal Android compatible.
// ════════════════════════════════════════════════════════════════

var CACHE_NAME = 'c5x-sw-v4';

// ── Obtener URL absoluta relativa al scope del SW ────────────────
// self.registration.scope termina en '/' → ej: https://user.github.io/repo/
function iconUrl(filename) {
  return self.registration.scope + (filename || 'icon.png');
}

// ── Install: activar inmediatamente sin esperar ──────────────────
self.addEventListener('install', function (e) {
  self.skipWaiting();
});

// ── Activate: tomar control de todos los clientes ───────────────
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ── Fetch: solo cachear assets estáticos críticos ───────────────
self.addEventListener('fetch', function (e) {
  // Solo cachear GET requests de assets (no API calls)
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  // Dejar pasar llamadas a APIs externas sin cachear
  if (url.includes('gate.io') || url.includes('supabase') ||
      url.includes('tradingview') || url.includes('api.')) return;
  // Estrategia: Network First para HTML, Cache First para assets
  if (url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(function (res) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
          return res;
        })
        .catch(function () { return caches.match(e.request); })
    );
  }
});

// ── Push event: notificaciones en background ────────────────────
self.addEventListener('push', function (e) {
  var data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    data = { title: '5X', body: e.data ? e.data.text() : '' };
  }

  var title = data.title || '5X — Nueva alerta';
  var options = {
    body:               data.body || '',
    tag:                data.tag  || 'c5x-push-' + Date.now(),
    icon:               data.icon || iconUrl('icon.png'),
    badge:              iconUrl('badge.png'),    // monocromo para barra Android
    vibrate:            data.vibrate || [200, 100, 200],
    requireInteraction: !!data.requireInteraction,
    silent:             false,
    timestamp:          data.timestamp || Date.now(),
    renotify:           false,
    data:               data.data || {}
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Click en notificación → abrir / enfocar la app ──────────────
self.addEventListener('notificationclick', function (e) {
  e.notification.close();

  // URL correcta de la app (respeta subdirectorios de GitHub Pages)
  var appUrl = self.registration.scope;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (list) {
        // Buscar ventana ya abierta con la URL de la app
        for (var i = 0; i < list.length; i++) {
          var client = list[i];
          if (client.url.startsWith(appUrl)) {
            if ('focus' in client) return client.focus();
          }
        }
        // Abrir nueva ventana si no hay ninguna abierta
        if (self.clients.openWindow) return self.clients.openWindow(appUrl);
        return null;
      })
  );
});

// ── Background Sync ──────────────────────────────────────────────
self.addEventListener('sync', function (e) {
  if (e.tag === 'c5x-market-check') {
    // El cliente maneja la lógica de mercado; SW solo despierta la app
  }
});

// ── Mensajes desde la app principal ─────────────────────────────
self.addEventListener('message', function (e) {
  if (!e.data) return;

  // PING de handshake
  if (e.data.type === 'PING') {
    if (e.source) e.source.postMessage({ type: 'SW_READY' });
    return;
  }

  // Mostrar notificación enviada desde el cliente (foreground)
  if (e.data.type === 'SHOW_NOTIF') {
    var d = e.data;
    self.registration.showNotification(d.title || '5X', {
      body:               d.body               || '',
      tag:                d.tag                || 'c5x-' + Date.now(),
      icon:               iconUrl('icon.png'),
      badge:              iconUrl('badge.png'), // monocromo para barra Android
      vibrate:            d.vibrate            || [200, 100, 200],
      requireInteraction: !!d.requireInteraction,
      silent:             false,
      timestamp:          d.timestamp          || Date.now(),
      renotify:           false,
      data:               d.data               || {}
    }).catch(function () {});
    return;
  }

  // Sincronización de estado de slots
  if (e.data.type === 'SYNC_STATE') {
    // Estado recibido y almacenado en cache para uso offline
    try {
      caches.open(CACHE_NAME).then(function (cache) {
        if (e.data.slots) {
          cache.put('/_state/c5x_slots',
            new Response(JSON.stringify(e.data.slots)));
        }
        if (e.data.slotModes) {
          cache.put('/_state/c5x_slot_modes',
            new Response(JSON.stringify(e.data.slotModes)));
        }
      });
    } catch (err) {}
    return;
  }
});
