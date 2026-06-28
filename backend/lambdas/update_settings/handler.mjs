/**
 * GET /settings  — Retrieve user settings
 * PUT /settings  — Update user settings
 * Body (PUT): { workDuration, shortBreakDuration, longBreakDuration, dailyGoal, autoStartBreaks }
 */
import {
  ok, badReq, unauth, err,
  getUserId, nowIso, dbGet, dbPut, dbUpdate, log,
} from '/opt/nodejs/utils.mjs';

const DEFAULT_SETTINGS = {
  workDuration:       25,
  shortBreakDuration: 5,
  longBreakDuration:  15,
  dailyGoal:          8,
  autoStartBreaks:    false,
  theme:              'dark',
};

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) return unauth();

    const method = event.requestContext?.http?.method || event.httpMethod;

    if (method === 'GET') {
      const settings = await dbGet(`USER#${userId}`, 'SETTINGS');
      return ok(settings ? {
        workDuration:       settings.workDuration,
        shortBreakDuration: settings.shortBreakDuration,
        longBreakDuration:  settings.longBreakDuration,
        dailyGoal:          settings.dailyGoal,
        autoStartBreaks:    settings.autoStartBreaks,
        theme:              settings.theme,
      } : DEFAULT_SETTINGS);
    }

    if (method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const now  = nowIso();

      // Validate
      const intFields = ['workDuration', 'shortBreakDuration', 'longBreakDuration', 'dailyGoal'];
      for (const f of intFields) {
        if (body[f] !== undefined && (typeof body[f] !== 'number' || body[f] <= 0)) {
          return badReq(`${f} must be a positive number`);
        }
      }

      const current  = await dbGet(`USER#${userId}`, 'SETTINGS') || { ...DEFAULT_SETTINGS };
      const updated  = {
        PK:                 `USER#${userId}`,
        SK:                 'SETTINGS',
        ...current,
        ...body,
        updatedAt:          now,
      };

      await dbPut(updated);
      log.info('Settings updated', { userId });
      return ok({
        workDuration:       updated.workDuration,
        shortBreakDuration: updated.shortBreakDuration,
        longBreakDuration:  updated.longBreakDuration,
        dailyGoal:          updated.dailyGoal,
        autoStartBreaks:    updated.autoStartBreaks,
        theme:              updated.theme,
      });
    }

    return badReq('Method not allowed');
  } catch (e) {
    log.error('updateSettings error', e);
    return err();
  }
};
