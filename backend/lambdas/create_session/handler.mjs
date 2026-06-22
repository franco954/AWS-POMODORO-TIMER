/**
 * POST /sessions — Create a new Pomodoro session
 * Body: { type: 'work'|'short_break'|'long_break', duration: number, notes?: string }
 */
import { ok, created, badReq, unauth, err, getUserId, newId, nowIso, todayStr, dbPut, dbUpdate, log } from '../shared/utils.mjs';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) return unauth();

    const body = JSON.parse(event.body || '{}');
    const { type = 'work', duration, notes = '' } = body;

    if (!duration || typeof duration !== 'number' || duration <= 0) {
      return badReq('duration (minutes) is required and must be a positive number');
    }
    if (!['work', 'short_break', 'long_break'].includes(type)) {
      return badReq('type must be work | short_break | long_break');
    }

    const sessionId  = newId();
    const startTime  = nowIso();
    const today      = todayStr();

    const session = {
      PK:        `USER#${userId}`,
      SK:        `SESSION#${startTime}#${sessionId}`,
      GSI1PK:    `DATE#${today}`,
      GSI1SK:    `SESSION#${startTime}`,
      sessionId,
      userId,
      type,
      duration,       // planned duration in minutes
      notes,
      status:    'active',
      startTime,
      createdAt: startTime,
    };

    await dbPut(session);

    log.info('Session created', { userId, sessionId, type, duration });
    return created({ sessionId, startTime, type, duration, status: 'active' });
  } catch (e) {
    log.error('createSession error', e);
    return err();
  }
};
