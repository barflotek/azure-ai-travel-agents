import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    const { data, error } = await supabase
      .from('agent_conversations')
      .insert([conversation])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getConversation(id: string) {
    const { data, error } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  static async saveBusinessConnection(connection: Partial<BusinessConnection>) {
    const { data, error } = await supabase
      .from('business_connections')
      .upsert([connection])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getActiveConnections(userId: string, integrationType?: string) {
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