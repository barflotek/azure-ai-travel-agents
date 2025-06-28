import { supabase, SupabaseClient } from './supabase/client';

export async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test basic connection
    const { data, error } = await supabase!.from('user_profiles').select('count').limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('📊 Database is ready for business agents');
    return true;
    
  } catch (error) {
    console.log('❌ Connection test failed:', error);
    return false;
  }
} 