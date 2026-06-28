/**
 * PUT /sessions/{id} — Complete or cancel a Pomodoro session
 * Body: { status: 'completed'|'cancelled', actualDuration?: number }
 * Path param: ?sessionStartTime=ISO8601  (needed to reconstruct SK)
 */
import {
  ok, badReq, unauth, notFound, err,
  getUserId, nowIso, todayStr,
  dbGet, dbUpdate, log,
  TABLE_NAME, REGION, CORS_ORIGIN,
} from '/opt/nodejs/utils.mjs';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const sqsClient = new SQSClient({ region: REGION });
const ddbClient = new DynamoDBClient({ region: REGION });
const ddb       = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (!userId) return unauth();

    const sessionId       = event.pathParameters?.id;
    const sessionStartTime = event.queryStringParameters?.startTime;

    if (!sessionId || !sessionStartTime) {
      return badReq('sessionId (path) and startTime (query) are required');
    }

    const body   = JSON.parse(event.body || '{}');
    const status = body.status;
    if (!['completed', 'cancelled'].includes(status)) {
      return badReq('status must be completed | cancelled');
    }

    const actualDuration = body.actualDuration ?? null;
    const endTime        = nowIso();
    const today          = todayStr();

    // Reconstruct SK
    const sk = `SESSION#${sessionStartTime}#${sessionId}`;

    // Update session in DynamoDB
    const updated = await dbUpdate(
      `USER#${userId}`,
      sk,
      'SET #status = :status, endTime = :endTime, actualDuration = :ad, updatedAt = :ua',
      { '#status': 'status' },
      {
        ':status': status,
        ':endTime': endTime,
        ':ad': actualDuration,
        ':ua': endTime,
      }
    );

    if (!updated) return notFound('Session not found');

    // If completed → enqueue to SQS for notification processing
    if (status === 'completed') {
      const message = {
        userId,
        sessionId,
        type:            updated.type,
        duration:        updated.duration,
        actualDuration:  actualDuration ?? updated.duration,
        completedAt:     endTime,
        date:            today,
      };

      await sqsClient.send(new SendMessageCommand({
        QueueUrl:    process.env.SQS_QUEUE_URL,
        MessageBody: JSON.stringify(message),
      }));

      log.info('Session completed, enqueued notification', { userId, sessionId });
    }

    return ok({ sessionId, status, endTime, actualDuration });
  } catch (e) {
    log.error('completeSession error', e);
    return err();
  }
};
