/**
 * GET /sessions — List paginated session history for the authenticated user
 * Query params: limit (default 20), date (YYYY-MM-DD filter), type (work|short_break|long_break)
 */
import { ok, unauth, err, getUserId, dbQuery, log } from '../shared/utils.mjs';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) return unauth();

    const qs    = event.queryStringParameters || {};
    const limit = Math.min(parseInt(qs.limit || '20', 10), 100);

    const sessions = await dbQuery(`USER#${userId}`, 'SESSION#', limit);

    // Client-side filters (cheap since DynamoDB query already scopes by user)
    let filtered = sessions;
    if (qs.type) {
      filtered = filtered.filter(s => s.type === qs.type);
    }
    if (qs.date) {
      filtered = filtered.filter(s => s.startTime?.startsWith(qs.date));
    }
    if (qs.status) {
      filtered = filtered.filter(s => s.status === qs.status);
    }

    log.info('Get sessions', { userId, count: filtered.length });
    return ok({
      sessions: filtered.map(s => ({
        sessionId:      s.sessionId,
        type:           s.type,
        status:         s.status,
        duration:       s.duration,
        actualDuration: s.actualDuration,
        notes:          s.notes,
        startTime:      s.startTime,
        endTime:        s.endTime,
        createdAt:      s.createdAt,
      })),
      count: filtered.length,
    });
  } catch (e) {
    log.error('getSessions error', e);
    return err();
  }
};
