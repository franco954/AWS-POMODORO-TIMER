/**
 * Cognito Post Confirmation Trigger
 * Initializes user record in DynamoDB after email verification
 */
import { dbPut, log, nowIso } from '../shared/utils.mjs';

export const handler = async (event) => {
  log.info('Post confirmation trigger', { userId: event.userName });

  const { sub: userId, email, name } = event.request.userAttributes;

  try {
    // Create user settings record with defaults
    await dbPut({
      PK:                 `USER#${userId}`,
      SK:                 'SETTINGS',
      GSI1PK:             `USER#${userId}`,
      GSI1SK:             'SETTINGS',
      userId,
      email,
      name:               name || email.split('@')[0],
      workDuration:       25,
      shortBreakDuration: 5,
      longBreakDuration:  15,
      dailyGoal:          8,
      autoStartBreaks:    false,
      theme:              'dark',
      createdAt:          nowIso(),
      updatedAt:          nowIso(),
    });

    log.info('User initialized in DynamoDB', { userId, email });
  } catch (e) {
    log.error('Failed to initialize user', { userId, error: e.message });
    // Do NOT throw — returning the event allows Cognito to continue signup
    // even if DynamoDB init fails (user can be re-initialized on first API call)
  }

  // Must return the event object to Cognito
  return event;
};
