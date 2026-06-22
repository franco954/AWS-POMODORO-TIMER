"""
Shared utilities for all Lambda functions.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from functools import wraps
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Environment Variables ──────────────────────────────────────────────────────
TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "pomodoro-sessions")
REGION = os.environ.get("AWS_REGION", "us-east-1")

# ── DynamoDB resource ──────────────────────────────────────────────────────────
dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)


# ── HTTP Response helpers ──────────────────────────────────────────────────────
CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": os.environ.get("CORS_ORIGIN", "*"),
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def response(status_code: int, body: Any) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
    }


def ok(body: Any) -> dict:
    return response(200, body)


def created(body: Any) -> dict:
    return response(201, body)


def bad_request(message: str) -> dict:
    return response(400, {"error": message})


def unauthorized() -> dict:
    return response(401, {"error": "Unauthorized"})


def not_found(message: str = "Resource not found") -> dict:
    return response(404, {"error": message})


def internal_error(message: str = "Internal server error") -> dict:
    return response(500, {"error": message})


# ── Auth helpers ───────────────────────────────────────────────────────────────
def get_user_id(event: dict) -> str | None:
    """Extract userId from Cognito JWT claims injected by API Gateway."""
    try:
        return event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    except (KeyError, TypeError):
        return None


def require_auth(handler):
    """Decorator that ensures a valid userId is present."""

    @wraps(handler)
    def wrapper(event, context):
        user_id = get_user_id(event)
        if not user_id:
            return unauthorized()
        return handler(event, context, user_id)

    return wrapper


# ── ID / time helpers ──────────────────────────────────────────────────────────
def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ── DynamoDB helpers ───────────────────────────────────────────────────────────
def put_item(item: dict) -> bool:
    try:
        table.put_item(Item=item)
        return True
    except ClientError as e:
        logger.error("DynamoDB put_item error: %s", e)
        return False


def get_item(pk: str, sk: str) -> dict | None:
    try:
        result = table.get_item(Key={"PK": pk, "SK": sk})
        return result.get("Item")
    except ClientError as e:
        logger.error("DynamoDB get_item error: %s", e)
        return None


def update_item(pk: str, sk: str, update_expr: str, expr_names: dict, expr_values: dict) -> dict | None:
    try:
        result = table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW",
        )
        return result.get("Attributes")
    except ClientError as e:
        logger.error("DynamoDB update_item error: %s", e)
        return None


def query_items(pk: str, sk_begins_with: str | None = None, limit: int = 50) -> list:
    try:
        kwargs: dict = {
            "KeyConditionExpression": "PK = :pk",
            "ExpressionAttributeValues": {":pk": pk},
            "ScanIndexForward": False,  # newest first
            "Limit": limit,
        }
        if sk_begins_with:
            kwargs["KeyConditionExpression"] += " AND begins_with(SK, :sk_prefix)"
            kwargs["ExpressionAttributeValues"][":sk_prefix"] = sk_begins_with
        result = table.query(**kwargs)
        return result.get("Items", [])
    except ClientError as e:
        logger.error("DynamoDB query error: %s", e)
        return []
