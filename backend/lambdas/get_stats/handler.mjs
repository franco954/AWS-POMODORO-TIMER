/**
 * GET /stats — Aggregate stats for the authenticated user
 * Returns: today's count, weekly count, total sessions, total minutes, streak
 */
import { ok, unauth, err, getUserId, todayStr, dbQuery, log } from '../shared/utils.mjs';

const getWeekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
};

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) return unauth();

    const today     = todayStr();
    const weekStart = getWeekStart();

    // Fetch last 200 completed work sessions (enough for streak calc)
    const allSessions = await dbQuery(`USER#${userId}`, 'SESSION#', 200);
    const completed   = allSessions.filter(s => s.status === 'completed' && s.type === 'work');

    const todaySessions   = completed.filter(s => s.startTime?.startsWith(today));
    const weeklySessions  = completed.filter(s => s.startTime >= `${weekStart}T00:00:00.000Z`);
    const totalMinutes    = completed.reduce((acc, s) => acc + (s.actualDuration ?? s.duration ?? 0), 0);

    // Calculate daily streak
    let streak = 0;
    const sessionDays = [...new Set(completed.map(s => s.startTime?.split('T')[0]))].sort().reverse();
    let checkDate = new Date(today);
    for (const day of sessionDays) {
      if (day === checkDate.toISOString().split('T')[0]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }

    log.info('Get stats', { userId, total: completed.length, streak });
    return ok({
      today: {
        sessionsCompleted: todaySessions.length,
        minutesFocused:    todaySessions.reduce((a, s) => a + (s.actualDuration ?? s.duration ?? 0), 0),
      },
      week: {
        sessionsCompleted: weeklySessions.length,
        minutesFocused:    weeklySessions.reduce((a, s) => a + (s.actualDuration ?? s.duration ?? 0), 0),
      },
      all: {
        sessionsCompleted: completed.length,
        totalMinutes,
        totalHours:        Math.floor(totalMinutes / 60),
        streak,
      },
    });
  } catch (e) {
    log.error('getStats error', e);
    return err();
  }
};
