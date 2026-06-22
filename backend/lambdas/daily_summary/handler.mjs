/**
 * EventBridge Cron — Daily Summary
 * Runs every day at 08:00 UTC
 * Queries all users' sessions from yesterday and logs summary
 * (Extend with SES email if needed)
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { log, REGION } from '../shared/utils.mjs';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb       = DynamoDBDocumentClient.from(ddbClient);

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

export const handler = async (event) => {
  log.info('Daily summary job triggered', { event });

  const yesterday = getYesterday();

  try {
    // GSI query: all sessions from yesterday
    const result = await ddb.send(new ScanCommand({
      TableName:        process.env.DYNAMODB_TABLE,
      FilterExpression: 'begins_with(SK, :sk) AND #status = :completed',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':sk':        `SESSION#${yesterday}`,
        ':completed': 'completed',
      },
    }));

    const sessions = result.Items || [];
    const uniqueUsers = [...new Set(sessions.map(s => s.userId))];

    const summary = {
      date:               yesterday,
      totalSessions:      sessions.length,
      activeUsers:        uniqueUsers.length,
      totalMinutes:       sessions.reduce((a, s) => a + (s.actualDuration ?? s.duration ?? 0), 0),
    };

    log.info('Daily summary complete', summary);

    // TODO: Extend with SES to email users their personal summaries
    // This is a scaffold — per-user summaries can be added here

    return { statusCode: 200, body: JSON.stringify(summary) };
  } catch (e) {
    log.error('Daily summary error', e);
    throw e;
  }
};
