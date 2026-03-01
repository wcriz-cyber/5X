// ═══════════════════════════════════════════════════════════════
// ARCHIVO 1: src/supabaseSync.js
// Sincroniza el estado del bot con Supabase para que el monitor
// pueda vigilar órdenes aunque la app esté cerrada
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = "https://arqrafxtpnnqzbpbxkzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycXJhZnh0cG5ucXpicGJ4a3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODg3MjQsImV4cCI6MjA4Nzg2NDcyNH0.IsPCInAhJrjBEa9x4B1vS-T0GXd2B5cHpHW5bRQ2JFo";
// ↑ Esta es tu anon key pública (está bien que esté en el cliente)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/**
 * Guarda el estado completo del bot en Supabase
 * Llama esta función cada vez que el estado del bot cambie
 *
 * @param {string} userId       - ID del usuario (ej: "admin_001", "criz_002")
 * @param {object} botState     - El estado completo del bot (slots, orders, etc.)
 * @param {string} gateKey      - API Key de Gate.io del usuario
 * @param {string} gateSecret   - API Secret de Gate.io del usuario
 */
export async function syncBotState(userId, botState, gateKey, gateSecret) {
  if (!userId || !botState) {
    console.warn('[sync] userId o botState vacíos — no se sincroniza');
    return;
  }

  const { error } = await supabase
    .from('bot_state')
    .upsert({
      user_id:         userId,
      state:           botState,
      gate_key_enc:    gateKey    || '',
      gate_secret_enc: gateSecret || '',
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('[sync] Error guardando bot_state:', error.message);
  } else {
    console.log('[sync] ✅ bot_state guardado para', userId);
  }
}

/**
 * Lee el estado del bot desde Supabase
 * Útil para restaurar el estado al abrir la app
 */
export async function loadBotState(userId) {
  const { data, error } = await supabase
    .from('bot_state')
    .select('state, gate_key_enc, gate_secret_enc, updated_at')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.warn('[sync] No se encontró estado para', userId);
    return null;
  }
  return data;
}

/**
 * Lee las notificaciones del bot (órdenes ejecutadas, enviadas, etc.)
 * Llama esto al abrir la app para mostrar lo que pasó mientras estaba cerrada
 */
export async function loadNotifications(userId) {
  const { data, error } = await supabase
    .from('bot_notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[sync] Error cargando notificaciones:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Marca todas las notificaciones de un usuario como leídas
 */
export async function markNotificationsRead(userId) {
  await supabase
    .from('bot_notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

/**
 * Suscribirse a notificaciones en tiempo real (Realtime)
 * El callback se llama cada vez que llega una notificación nueva
 *
 * @param {string}   userId   - ID del usuario
 * @param {function} callback - función(notification) que se ejecuta al recibir notif
 * @returns {function} unsubscribe - llama esto para cancelar la suscripción
 */
export function subscribeToNotifications(userId, callback) {
  const channel = supabase
    .channel(`notif_${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'bot_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('[realtime] 🔔 Nueva notificación:', payload.new);
        callback(payload.new);
      }
    )
    .subscribe();

  // Retorna función para cancelar la suscripción
  return () => supabase.removeChannel(channel);
}
