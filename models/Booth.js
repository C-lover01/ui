// models/Booth.js - Booth entity model directly querying Supabase
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import bcrypt from 'bcryptjs';

export class Booth {
  static async getAll() {
    if (!isSupabaseConfigured() || !supabase) return [];
    const { data, error } = await supabase.from('booths').select('*');
    if (error) {
      console.error('[Supabase] Booth.getAll error:', error.message);
      return [];
    }
    return data || [];
  }

  static async findById(id) {
    if (!id) return Booth.getDefault();
    const cleanId = id.trim();

    if (!isSupabaseConfigured() || !supabase) {
      return { id: cleanId, name: cleanId, location: 'Ground Floor' };
    }

    const { data, error } = await supabase
      .from('booths')
      .select('*')
      .ilike('id', cleanId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] Booth.findById error:', error.message);
      return { id: cleanId, name: cleanId, location: 'Ground Floor' };
    }
    return data || { id: cleanId, name: cleanId, location: 'Ground Floor' };
  }

  static async findByUsername(username) {
    if (!username || !isSupabaseConfigured() || !supabase) return null;
    const cleanUser = username.trim().toLowerCase();

    const { data: userRecord, error } = await supabase
      .from('booth_users')
      .select('booth_id')
      .ilike('username', cleanUser)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] Booth.findByUsername error:', error.message);
      return null;
    }

    if (userRecord && userRecord.booth_id) {
      return await Booth.findById(userRecord.booth_id);
    }
    return null;
  }

  /**
   * Validate credentials against booth_users table in Supabase.
   * Returns { user, booth } on success, or null on failure.
   */
  static async validateLogin(username, password) {
    if (!username || !password || !isSupabaseConfigured() || !supabase) return null;
    const cleanUser = username.trim().toLowerCase();

    // 1. Look up user by username in booth_users
    let { data: userRecord, error } = await supabase
      .from('booth_users')
      .select('*')
      .ilike('username', cleanUser)
      .maybeSingle();

    // 2. If not found by username, try looking up by booth_id (e.g. user typed "BOOTH001")
    if (!userRecord) {
      const { data: userByBooth } = await supabase
        .from('booth_users')
        .select('*')
        .ilike('booth_id', cleanUser)
        .maybeSingle();
      if (userByBooth) {
        userRecord = userByBooth;
      }
    }

    if (!userRecord) return null;

    // 3. Strict bcrypt password verification
    const hash = userRecord.password_hash || '';
    if (!hash) return null;

    let isMatch = false;
    try {
      const normalizedHash = hash.replace(/^\$2y\$/, '$2a$');
      isMatch = bcrypt.compareSync(password, normalizedHash);
    } catch (e) {
      console.error('[Booth.validateLogin] Bcrypt error:', e.message);
      isMatch = false;
    }

    if (!isMatch) return null;

    const booth = await Booth.findById(userRecord.booth_id);
    return {
      user: userRecord,
      booth: booth || { id: userRecord.booth_id, name: userRecord.booth_id, location: 'Ground Floor' }
    };
  }

  static getDefault() {
    return {
      id: 'BOOTH001',
      name: 'Tech Innovation',
      location: 'Ground Floor',
      description: 'Showcase of innovative technology',
      sponsorName: 'Tech Solutions Inc.'
    };
  }
}

