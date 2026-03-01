// ═══════════════════════════════════════════════════════════════
// ARCHIVO 2: src/hooks/useBotSync.js
// Hook de React que maneja toda la sincronización automáticamente
// ═══════════════════════════════════════════════════════════════

import { useEffect, useCallback, useRef } from 'react';
import {
  syncBotState,
  loadBotState,
  loadNotifications,
  markNotificationsRead,
  subscribeToNotifications,
} from '../supabaseSync';

/**
 * Hook principal para sincronizar el bot con Supabase
 *
 * CÓMO USAR en tu componente principal (App.jsx o BotPanel.jsx):
 *
 *   const { syncNow, loadFromSupabase } = useBotSync({
 *     userId:      currentUser?.id,      // ej: "admin_001"
 *     botState:    state,                // tu estado del bot
 *     gateKey:     apiKey,               // la API key de Gate.io
 *     gateSecret:  apiSecret,            // el API secret de Gate.io
 *     onNotification: (notif) => {       // callback al recibir notificación
 *       toast.success(notif.title);
 *       setNotifications(prev => [notif, ...prev]);
 *     }
 *   });
 */
export function useBotSync({ userId, botState, gateKey, gateSecret, onNotification }) {
  const syncTimerRef   = useRef(null);
  const unsubscribeRef = useRef(null);

  // ── Sincronizar manualmente ahora ───────────────────────────
  const syncNow = useCallback(async () => {
    if (!userId || !botState) return;
    await syncBotState(userId, botState, gateKey, gateSecret);
  }, [userId, botState, gateKey, gateSecret]);

  // ── Cargar estado guardado desde Supabase ───────────────────
  const loadFromSupabase = useCallback(async () => {
    if (!userId) return null;
    return await loadBotState(userId);
  }, [userId]);

  // ── Cargar notificaciones pendientes ────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!userId) return [];
    const notifs = await loadNotifications(userId);
    if (notifs.length > 0 && onNotification) {
      notifs.forEach(n => onNotification(n));
      await markNotificationsRead(userId);
    }
    return notifs;
  }, [userId, onNotification]);

  // ── Auto-sync cada 30 segundos mientras la app está abierta ─
  useEffect(() => {
    if (!userId || !botState) return;

    // Sincronizar inmediatamente
    syncNow();

    // Luego cada 30 segundos
    syncTimerRef.current = setInterval(syncNow, 30_000);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [userId, botState, gateKey, gateSecret]); // se re-ejecuta cuando cambia el estado

  // ── Suscribirse a notificaciones en tiempo real ─────────────
  useEffect(() => {
    if (!userId || !onNotification) return;

    // Primero cargar notificaciones que llegaron mientras la app estaba cerrada
    fetchNotifications();

    // Luego suscribirse a nuevas notificaciones en tiempo real
    unsubscribeRef.current = subscribeToNotifications(userId, onNotification);

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [userId]);

  return { syncNow, loadFromSupabase, fetchNotifications };
}
