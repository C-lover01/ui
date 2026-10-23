// controllers/LeaderboardController.js - Aggregates points directly from Supabase scan_logs
import { ScanLog } from '../models/ScanLog.js';

export class LeaderboardController {
  static async showLeaderboard(req, res) {
    try {
      const eventId = req.session.event_id || req.session.eventId || req.query.event_id || 1;
      const standings = await ScanLog.getLeaderboard(eventId);
      const sid = req.sessionID || req.query.sid || '';
      const isLoggedIn = !!(req.session && req.session.isLoggedIn);

      res.render('Leaderboard', {
        currentPage: 'Leaderboard.php',
        top1: standings[0] || { id: 'No Scans Yet', points: 0 },
        top2: standings[1] || { id: 'No Scans Yet', points: 0 },
        top3: standings[2] || { id: 'No Scans Yet', points: 0 },
        ranks4to7: standings.slice(3, 7),
        ranks8to12: standings.slice(7, 12),
        isLoggedIn,
        sid
      });
    } catch (err) {
      console.error('LeaderboardController error:', err);
      const sid = req.sessionID || req.query.sid || '';
      const isLoggedIn = !!(req.session && req.session.isLoggedIn);
      res.render('Leaderboard', {
        currentPage: 'Leaderboard.php',
        top1: { id: 'Waiting for Supabase', points: 0 },
        top2: { id: 'Waiting for Supabase', points: 0 },
        top3: { id: 'Waiting for Supabase', points: 0 },
        ranks4to7: [],
        ranks8to12: [],
        isLoggedIn,
        sid
      });
    }
  }

  static async getLeaderboardApi(req, res) {
    try {
      const eventId = req.query.event_id || 1;
      const standings = await ScanLog.getLeaderboard(eventId);
      res.json({ success: true, standings });
    } catch (err) {
      res.status(500).json({ success: false, standings: [] });
    }
  }
}
