// controllers/ScanController.js - Handles QR code scanning, tier point allocation, and scan logs
import { Attendee } from '../models/Attendee.js';
import { Booth } from '../models/Booth.js';
import { Event } from '../models/Event.js';
import { ScanLog } from '../models/ScanLog.js';
import { isSupabaseConfigured } from '../config/supabase.js';

export class ScanController {
  /**
   * Process a QR code scan when an attendee finishes a challenge at a booth.
   */
  static async processScan(req, res) {
    try {
      if (!isSupabaseConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Supabase credentials missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env.'
        });
      }

      if (!req.session || !req.session.isLoggedIn) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Please log in with a booth account.'
        });
      }

      const boothId = req.session.booth_IDs || req.session.booth_id || req.session.boothId;
      const eventId = req.session.event_id || req.session.eventId || 1;

      if (!boothId) {
        return res.status(403).json({
          success: false,
          message: 'No assigned booth found in active session.'
        });
      }

      const qrCode = req.body.qr_code || req.body.id || req.body.code;
      const attendeeName = req.body.name || req.body.attendee_name;

      if (!qrCode && !attendeeName) {
        return res.status(400).json({
          success: false,
          message: 'No QR code or Attendee ID provided.'
        });
      }

      // Verify or retrieve booth and event from Supabase
      const booth = (await Booth.findById(boothId)) || Booth.getDefault();
      const event = (await Event.findById(eventId)) || Event.getDefault();

      // Find or create the attendee entity in Supabase
      const attendee = await Attendee.getOrCreate({
        qrToken: qrCode ? qrCode.trim() : null,
        name: attendeeName ? attendeeName.trim() : null
      });

      // Check if Attendee has already finished this challenge (UNIQUE_ATTENDEE_BOOTH_EVENT in Supabase)
      const alreadyScanned = await ScanLog.hasScanned(attendee.id, booth.id, event.id);
      if (alreadyScanned) {
        const fullName = Attendee.getFullName(attendee);
        return res.status(409).json({
          success: false,
          alreadyScanned: true,
          attendeeId: attendee.qr_code_token || `ID 00${attendee.id}`,
          attendeeName: fullName,
          message: `${fullName} has already completed the challenge at ${booth.name}!`
        });
      }

      // Count previous completions directly in Supabase
      const existingScanCount = await ScanLog.countByBoothAndEvent(booth.id, event.id);

      // Determine points & tier category based on previous scan count:
      // within first 10 -> 100 PTS ('1-10')
      // 11 to 50        -> 85 PTS  ('11-50')
      // 51 to 90        -> 65 PTS  ('51-90')
      // 91+             -> 45 PTS  ('91+')
      const tierResult = ScanLog.calculatePointsForScanCount(existingScanCount);

      // Store directly in Supabase scan_logs table
      const createdLog = await ScanLog.create({
        attendeeId: attendee.id,
        boothId: booth.id,
        eventId: event.id,
        points: tierResult.points,
        category: tierResult.category
      });

      const totalScans = existingScanCount + 1;
      const nextTierInfo = ScanLog.calculatePointsForScanCount(totalScans);

      const timeStr = new Date(createdLog.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      return res.status(201).json({
        success: true,
        message: `✓ ${Attendee.getFullName(attendee)} Scanned (+${tierResult.points} PTS)`,
        scan: {
          id: createdLog.id,
          attendeeId: attendee.qr_code_token || `ID 00${attendee.id}`,
          attendeeDbId: attendee.id,
          attendeeName: Attendee.getFullName(attendee),
          points: tierResult.points,
          category: tierResult.category,
          timestamp: timeStr,
          boothId: booth.id,
          boothName: booth.name
        },
        stats: {
          totalScans,
          currentTierPoints: tierResult.points,
          currentCategory: tierResult.category,
          nextTierPoints: nextTierInfo.points
        }
      });
    } catch (err) {
      console.error('ScanController error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'An error occurred while recording the scan in Supabase.'
      });
    }
  }

  /**
   * Return recent scans feed for current booth directly from Supabase.
   */
  static async getFeed(req, res) {
    try {
      if (!req.session || !req.session.isLoggedIn) {
        return res.status(401).json({ success: false, scans: [], totalScans: 0, message: 'Unauthorized' });
      }

      const boothId = req.session.booth_IDs || req.session.booth_id || req.session.boothId;
      if (!boothId) {
        return res.status(403).json({ success: false, scans: [], totalScans: 0, message: 'No assigned booth found' });
      }

      const eventId = req.session.event_id || req.session.eventId || 1;

      const scans = await ScanLog.getRecentScans(boothId, eventId);
      const totalScans = await ScanLog.countByBoothAndEvent(boothId, eventId);
      const activeTier = ScanLog.calculatePointsForScanCount(Math.max(0, totalScans - 1));

      res.json({
        success: true,
        boothId,
        scans,
        totalScans,
        activeTierPoints: activeTier.points
      });
    } catch (err) {
      console.error('getFeed error:', err);
      res.status(500).json({ success: false, scans: [], totalScans: 0 });
    }
  }
}
