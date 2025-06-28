import { createClient } from '@supabase/supabase-js';

// Check if Supabase is configured
const isSupabaseConfigured = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;

// Only create client if configured
export const supabase = isSupabaseConfigured 
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  : null;

// Database interfaces
export interface AgentConversation {
  id: string;
  user_id: string;
  agent_type: string;
  state: any;
  messages: any[];
  created_at: string;
  updated_at: string;
}

export interface BusinessConnection {
  id: string;
  user_id: string;
  integration_type: string; // 'gmail', 'stripe', 'facebook', etc.
  credentials: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentTask {
  id: string;
  user_id: string;
  agent_type: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input_data: any;
  output_data: any;
  created_at: string;
  completed_at?: string;
}

// Database helper functions
export class SupabaseClient {
  static async saveConversation(conversation: Partial<AgentConversation>) {
    if (!supabase) {
      console.log('⚠️ Supabase not configured, skipping conversation save');
      return { id: 'temp-' + Date.now(), ...conversation };
    }

    const { data, error } = await supabase
      .from('agent_conversations')
      .insert([conversation])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getConversation(id: string) {
    if (!supabase) {
      console.log('⚠️ Supabase not configured, cannot retrieve conversation');
      return null;
    }

    const { data, error } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  static async saveBusinessConnection(connection: Partial<BusinessConnection>) {
    if (!supabase) {
      console.log('⚠️ Supabase not configured, skipping business connection save');
      return { id: 'temp-' + Date.now(), ...connection };
    }

    const { data, error } = await supabase
      .from('business_connections')
      .upsert([connection])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getActiveConnections(userId: string, integrationType?: string) {
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
    if (error) throw error;
    return data;
  }
} 