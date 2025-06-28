import { createClient } from '@supabase/supabase-js';
// Check if Supabase is configured
const isSupabaseConfigured = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
// Only create client if configured
export const supabase = isSupabaseConfigured
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    : null;
// Database helper functions
export class SupabaseClient {
    static async saveConversation(conversation) {
        if (!supabase) {
            console.log('⚠️ Supabase not configured, skipping conversation save');
            return { id: 'temp-' + Date.now(), ...conversation };
        }
        const { data, error } = await supabase
            .from('agent_conversations')
            .insert([conversation])
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    static async getConversation(id) {
        if (!supabase) {
            console.log('⚠️ Supabase not configured, cannot retrieve conversation');
            return null;
        }
        const { data, error } = await supabase
            .from('agent_conversations')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    }
    static async saveBusinessConnection(connection) {
        if (!supabase) {
            console.log('⚠️ Supabase not configured, skipping business connection save');
            return { id: 'temp-' + Date.now(), ...connection };
        }
        const { data, error } = await supabase
            .from('business_connections')
            .upsert([connection])
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    static async getActiveConnections(userId, integrationType) {
        if (!supabase) {
            console.log('⚠️ Supabase not configured, returning empty connections list');
            return [];
        }
        let query = supabase
            .from('business_connections')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);
        if (integrationType) {
            query = query.eq('integration_type', integrationType);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data;
    }
}
