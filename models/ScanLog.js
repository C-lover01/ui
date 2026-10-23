// models/ScanLog.js - ScanLog model directly operating on Supabase scan_logs table
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { Attendee } from './Attendee.js';
import { Booth } from './Booth.js';

export class ScanLog {
  /**
   * Determine points and tier category based on previous completions.
   * 1st to 10th:   100 PTS ('1-10')
   * 11th to 50th:  85 PTS  ('11-50')
   * 51st to 90th:  65 PTS  ('51-90')
   * 91st+:         45 PTS  ('91+')
   */
  static calculatePointsForScanCount(existingCount) {
    const scanNumber = existingCount + 1;
    if (scanNumber <= 10) {
      return { points: 100, category: '1-10', tierIndex: 0 };
    } else if (scanNumber <= 50) {
      return { points: 85, category: '11-50', tierIndex: 1 };
    } else if (scanNumber <= 90) {
      return { points: 65, category: '51-90', tierIndex: 2 };
    } else {
      return { points: 45, category: '91+', tierIndex: 3 };
    }
  }

  /**
   * Count how many scans have already been recorded for this booth challenge directly in Supabase.
   */
  static async countByBoothAndEvent(boothId, eventId) {
    if (!isSupabaseConfigured() || !supabase) return 0;
    const bId = (boothId || '').trim();
    const eId = parseInt(eventId, 10);

    try {
      const { count, error } = await supabase
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .ilike('boothId', bId)
        .eq('eventId', eId);

      if (!error && typeof count === 'number') {
        return count;
      }

      // Fallback for unquoted lowercase column identifiers
      const retry = await supabase
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .ilike('boothid', bId)
        .eq('eventid', eId);

      return retry.count || 0;
    } catch (e) {
      console.error('[Supabase] countByBoothAndEvent error:', e.message);
      return 0;
    }
  }

  /**
   * Check if an attendee has already scanned at this booth for this event directly in Supabase
   * (Enforces UNIQUE_ATTENDEE_BOOTH_EVENT constraint).
   */
  static async hasScanned(attendeeId, boothId, eventId) {
    if (!isSupabaseConfigured() || !supabase) return false;
    const aId = parseInt(attendeeId, 10);
    const bId = (boothId || '').trim();
    const eId = parseInt(eventId, 10);

    try {
      const { data, error } = await supabase
        .from('scan_logs')
        .select('id')
        .eq('attendeeId', aId)
        .ilike('boothId', bId)
        .eq('eventId', eId)
        .maybeSingle();

      if (!error && data) return true;

      // Fallback for unquoted lowercase column identifiers
      const retry = await supabase
        .from('scan_logs')
        .select('id')
        .eq('attendeeid', aId)
        .ilike('boothid', bId)
        .eq('eventid', eId)
        .maybeSingle();

      return !!retry.data;
    } catch (e) {
      console.error('[Supabase] hasScanned check error:', e.message);
      return false;
    }
  }

  /**
   * Record a new scan log directly in Supabase scan_logs table.
   */
  static async create({ attendeeId, boothId, eventId, points, category }) {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env.');
    }

    const id = `SCAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payload = {
      id,
      attendeeId: parseInt(attendeeId, 10),
      boothId: (boothId || '').trim(),
      eventId: parseInt(eventId, 10),
      timestamp: new Date().toISOString(),
      points: parseInt(points, 10),
      category
    };

    let { data, error } = await supabase
      .from('scan_logs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Retry with lowercase column names if columns were created unquoted in Postgres
      const retry = await supabase
        .from('scan_logs')
        .insert({
          id,
          attendeeid: parseInt(attendeeId, 10),
          boothid: (boothId || '').trim(),
          eventid: parseInt(eventId, 10),
          timestamp: new Date().toISOString(),
          points: parseInt(points, 10),
          category
        })
        .select()
        .single();

      if (retry.error) {
        console.error('[Supabase] ScanLog.create error:', retry.error.message);
        throw new Error(`Failed to save scan in Supabase: ${retry.error.message}`);
      }
      data = retry.data;
    }

    return data || payload;
  }

  /**
   * Retrieve recent scans for a booth directly from Supabase, joined with attendee details.
   */
  static async getRecentScans(boothId, eventId, limit = 50) {
    if (!isSupabaseConfigured() || !supabase) return [];
    const bId = (boothId || '').trim();
    const eId = eventId ? parseInt(eventId, 10) : null;

    let query = supabase
      .from('scan_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (bId) {
      query = query.ilike('boothId', bId);
    }
    if (eId) {
      query = query.eq('eventId', eId);
    }

    const { data: logs, error } = await query;
    if (error || !logs) {
      console.error('[Supabase] getRecentScans error:', error?.message);
      return [];
    }

    // Join with attendee and booth details
    const results = await Promise.all(
      logs.map(async log => {
        const attId = log.attendeeId;
        const bIdVal = log.boothId;
        const evIdVal = log.eventId;

        const attendee = await Attendee.findById(attId);
        const booth = await Booth.findById(bIdVal);
        const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });

        return {
          id: log.id,
          attendeeId: attendee ? attendee.qr_code_token || `Attendee${String(attendee.id).padStart(3, '0')}` : `ID-${attId}`,
          attendeeDbId: attId,
          attendeeName: attendee ? Attendee.getFullName(attendee) : 'Unknown Attendee',
          boothId: bIdVal,
          boothName: booth ? booth.name : bIdVal,
          eventId: evIdVal,
          points: log.points,
          category: log.category,
          timestamp: timeStr,
          rawTimestamp: log.timestamp
        };
      })
    );

    return results;
  }

  /**
   * Aggregate total points across all booths directly from Supabase for the leaderboard.
   */
  static async getLeaderboard(eventId = null) {
    if (!isSupabaseConfigured() || !supabase) return [];
    let query = supabase.from('scan_logs').select('*');
    if (eventId) {
      query = query.eq('eventId', parseInt(eventId, 10));
    }

    const { data: logs, error } = await query;
    if (error) {
      console.error('[Supabase] getLeaderboard error:', error.message);
    }

    const totals = new Map();
    (logs || []).forEach(log => {
      const aId = log.attendeeId || log.attendeeid;
      const current = totals.get(aId) || 0;
      totals.set(aId, current + log.points);
    });

    const allAttendees = await Attendee.getAll();
    allAttendees.forEach(att => {
      if (!totals.has(att.id)) {
        totals.set(att.id, 0);
      }
    });

    const list = await Promise.all(
      Array.from(totals.entries()).map(async ([attId, points]) => {
        const attendee = await Attendee.findById(attId);
        return {
          id: attendee ? attendee.qr_code_token || `ID ${String(attId).padStart(3, '0')}` : `ID ${attId}`,
          rawId: attId,
          name: attendee ? Attendee.getFullName(attendee) : `Attendee ${attId}`,
          points,
          role: attendee ? attendee.role : 'Attendee'
        };
      })
    );

    list.sort((a, b) => b.points - a.points);

    return list.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }
}
