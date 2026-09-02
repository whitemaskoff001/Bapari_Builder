import { supabase } from './supabase';

export function subscribeTables(tables: string[], onChange: () => void) {
  let timer: number | null = null;
  const bump = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 250);
  };
  const channel = supabase.channel(`live-${tables.join('-')}-${Date.now()}`);
  for (const table of tables) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, bump);
  }
  channel.subscribe();
  return () => {
    if (timer) window.clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
