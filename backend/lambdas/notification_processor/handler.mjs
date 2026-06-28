/**
 * SQS Trigger — Notification Processor
 * Receives completed session events and sends Web Push notifications
 * (VAPID keys stored in SSM Parameter Store)
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { log, REGION } from '/opt/nodejs/utils.mjs';
import webpush from 'web-push';

const ssmClient = new SSMClient({ region: REGION });

let vapidInitialized = false;

const initVapid = async () => {
  if (vapidInitialized) return;
  const [pubKey, privKey, email] = await Promise.all([
    getParam('/pomodoro/vapid/public_key'),
    getParam('/pomodoro/vapid/private_key'),
    getParam('/pomodoro/vapid/email'),
  ]);
  webpush.setVapidDetails(`mailto:${email}`, pubKey, privKey);
  vapidInitialized = true;
};

const getParam = async (name) => {
  const res = await ssmClient.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  return res.Parameter.Value;
};

export const handler = async (event) => {
  const results = await Promise.allSettled(
    event.Records.map(record => processRecord(record))
  );

  // Return failed records so SQS retries them
  const failed = results
    .map((r, i) => r.status === 'rejected' ? event.Records[i] : null)
    .filter(Boolean);

  if (failed.length) {
    log.warn(`${failed.length} records failed`, failed.map(r => r.messageId));
    throw new Error(`Batch partially failed: ${failed.length} records`);
  }
};

const processRecord = async (record) => {
  const message = JSON.parse(record.body);
  const { userId, type, actualDuration, completedAt } = message;

  log.info('Processing notification', { userId, type });

  if (type !== 'work') {
    log.debug('Skipping notification for non-work session');
    return;
  }

  try {
    await initVapid();

    // Get user's push subscription from DynamoDB
    const { dbGet } = await import('/opt/nodejs/utils.mjs');
    const subscription = await dbGet(`USER#${userId}`, 'PUSH_SUBSCRIPTION');

    if (!subscription?.endpoint) {
      log.info('No push subscription for user', { userId });
      return;
    }

    const payload = JSON.stringify({
      title: '🍅 ¡Pomodoro completado!',
      body:  `Concentraste ${actualDuration} minutos. ¡Tomá un descanso!`,
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data:  { userId, completedAt, type: 'session_complete' },
    });

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth:   subscription.auth,
        },
      },
      payload,
      { TTL: 3600 }
    );

    log.info('Push notification sent', { userId });
  } catch (e) {
    if (e.statusCode === 410) {
      // Subscription expired — clean it up
      log.warn('Push subscription expired, removing', { userId });
      const { dbUpdate } = await import('/opt/nodejs/utils.mjs');
      await dbUpdate(
        `USER#${userId}`, 'PUSH_SUBSCRIPTION',
        'SET #active = :false',
        { '#active': 'active' },
        { ':false': false }
      );
      return; // Don't retry for expired subscriptions
    }
    log.error('Push notification failed', { userId, error: e.message });
    throw e;
  }
};
