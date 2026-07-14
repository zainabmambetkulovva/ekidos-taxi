import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hasSupabase = supabaseUrl.length > 10 && !supabaseUrl.includes('[YOUR');

let supabase: SupabaseClient | null = null;

if (hasSupabase) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export { supabase };

export async function uploadToStorage(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });

  if (error) {
    console.error('Storage upload error:', error.message);
    return null;
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function deleteFromStorage(bucket: string, path: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error('Storage delete error:', error.message);
    return false;
  }
  return true;
}
