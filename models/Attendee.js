// models/Attendee.js - Attendee entity model directly querying Supabase
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

export class Attendee {
  static async getAll() {
    if (!isSupabaseConfigured() || !supabase) return [];
    const { data, error } = await supabase.from('attendees').select('*');
    if (error) {
      console.error('[Supabase] Attendee.getAll error:', error.message);
      return [];
    }
    return data || [];
  }

  static async findById(id) {
    if (!id || !isSupabaseConfigured() || !supabase) return null;
    const numId = parseInt(id, 10);
    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .eq('id', numId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] Attendee.findById error:', error.message);
      return null;
    }
    return data;
  }

  static async findByQrToken(token) {
    if (!token || !isSupabaseConfigured() || !supabase) return null;
    const cleanToken = token.trim();

    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .ilike('qr_code_token', cleanToken)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] Attendee.findByQrToken error:', error.message);
      return null;
    }
    return data;
  }

  static async findByIdentifier(query) {
    if (!query || !isSupabaseConfigured() || !supabase) return null;
    const q = query.trim().toLowerCase();

    // 1. Exact match on QR token
    let match = await Attendee.findByQrToken(q);
    if (match) return match;

    // 2. Numeric ID match (e.g. "1", "Attendee001")
    const numericPart = q.replace(/\D/g, '');
    if (numericPart) {
      const num = parseInt(numericPart, 10);
      match = await Attendee.findById(num);
      if (match) return match;
    }

    // 3. Match on email or name
    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] Attendee.findByIdentifier error:', error.message);
      return null;
    }
    return data;
  }

  static async getOrCreate({ qrToken, name }) {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env.');
    }

    let attendee = null;
    if (qrToken) {
      attendee = await Attendee.findByQrToken(qrToken);
      if (attendee) return attendee;

      attendee = await Attendee.findByIdentifier(qrToken);
      if (attendee) return attendee;
    }

    let firstName = 'Attendee';
    let lastName = 'Guest';

    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || '';
    } else if (qrToken) {
      lastName = qrToken.replace(/^QR-?/i, '');
    }

    const payload = {
      first_name: firstName,
      last_name: lastName,
      email: `attendee-${Date.now()}@devfestbacolod.org`,
      twitter: null,
      company: 'DevFest Attendee',
      role: 'DevFest Attendee',
      qr_code_token: qrToken || `QR-ATTENDEE-${Date.now().toString().slice(-4)}`
    };

    const { data, error } = await supabase
      .from('attendees')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Attendee.getOrCreate insert error:', error.message);
      throw new Error(`Failed to create attendee in Supabase: ${error.message}`);
    }

    return data;
  }

  static getFullName(attendee) {
    if (!attendee) return 'Unknown Attendee';
    return `${attendee.first_name || ''} ${attendee.last_name || ''}`.trim() || 'Attendee';
  }
}
