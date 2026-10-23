// models/Admin.js - Admin entity model directly querying Supabase
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import bcrypt from 'bcryptjs';

export class Admin {
  static async getAll() {
    if (!isSupabaseConfigured() || !supabase) return [];
    const { data, error } = await supabase.from('admins').select('*');
    if (error) {
      console.error('[Supabase] Admin.getAll error:', error.message);
      return [];
    }
    return data || [];
  }

  static async findByUsername(username) {
    if (!username || !isSupabaseConfigured() || !supabase) return null;
    const cleanUser = username.trim().toLowerCase();
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .ilike('username', cleanUser)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] Admin.findByUsername error:', error.message);
      return null;
    }
    return data;
  }

  /**
   * Validate admin credentials against admins table in Supabase.
   * Returns admin record on success, or null on failure.
   */
  static async validateLogin(username, password) {
    if (!username || !password || !isSupabaseConfigured() || !supabase) return null;
    const cleanUser = username.trim().toLowerCase();

    const admin = await Admin.findByUsername(cleanUser);
    if (!admin) return null;

    const hash = admin.password_hash || '';
    if (!hash) return null;

    let isMatch = false;
    try {
      const normalizedHash = hash.replace(/^\$2y\$/, '$2a$');
      isMatch = bcrypt.compareSync(password, normalizedHash);
    } catch (e) {
      console.error('[Admin.validateLogin] Bcrypt error:', e.message);
      isMatch = false;
    }

    if (!isMatch) return null;
    return admin;
  }
}

