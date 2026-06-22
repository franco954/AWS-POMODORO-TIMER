/**
 * Shared utilities for all Lambda functions (Node.js 20)
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// ── Config ────────────────────────────────────────────────────────
export const TABLE_NAME = process.env.DYNAMODB_TABLE;
export const REGION = process.env.AWS_REGION || 'us-east-1';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ── DynamoDB Client ───────────────────────────────────────────────
const ddbClient = new DynamoDBClient({ region: REGION });
export const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// ── CORS Headers ──────────────────────────────────────────────────
export const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

// ── HTTP Response helpers ─────────────────────────────────────────
export const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

export const ok       = (body) => response(200, body);
export const created  = (body) => response(201, body);
export const badReq   = (msg)  => response(400, { error: msg });
export const unauth   = ()     => response(401, { error: 'Unauthorized' });
export const notFound = (msg = 'Not found') => response(404, { error: msg });
export const err      = (msg = 'Internal error') => response(500, { error: msg });

// ── Auth ──────────────────────────────────────────────────────────
export const getUserId = (event) =>
  event?.requestContext?.authorizer?.jwt?.claims?.sub ?? null;

// ── ID / Time helpers ─────────────────────────────────────────────
export const newId    = () => randomUUID();
export const nowIso   = () => new Date().toISOString();
export const todayStr = () => new Date().toISOString().split('T')[0];

// ── DynamoDB wrappers ─────────────────────────────────────────────
export const dbGet = async (pk, sk) => {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
  }));
  return res.Item ?? null;
};

export const dbPut = async (item) => {
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
};

export const dbUpdate = async (pk, sk, updateExpr, exprNames, exprValues) => {
  const res = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: updateExpr,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes ?? null;
};

export const dbQuery = async (pk, skPrefix = null, limit = 50) => {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
    ScanIndexForward: false,
    Limit: limit,
  };
  if (skPrefix) {
    params.KeyConditionExpression += ' AND begins_with(SK, :skp)';
    params.ExpressionAttributeValues[':skp'] = skPrefix;
  }
  const res = await ddb.send(new QueryCommand(params));
  return res.Items ?? [];
};

// ── Logger ────────────────────────────────────────────────────────
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const log = {
  debug: (...a) => LOG_LEVEL === 'debug' && console.debug('[DEBUG]', ...a),
  info:  (...a) => console.info('[INFO]', ...a),
  warn:  (...a) => console.warn('[WARN]', ...a),
  error: (...a) => console.error('[ERROR]', ...a),
};
