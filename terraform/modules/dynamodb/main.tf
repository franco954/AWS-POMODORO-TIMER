# ──────────────────────────────────────────────────────────────────
# Module: DynamoDB — Single-Table Design (Free Tier)
# Free Tier: 25 GB storage, 25 WCU, 25 RCU (Always Free)
# ──────────────────────────────────────────────────────────────────

variable "project_name" { type = string }
variable "environment"  { type = string }

resource "aws_dynamodb_table" "main" {
  name         = "${var.project_name}-${var.environment}"
  billing_mode = "PROVISIONED"  # Use provisioned to stay in free tier (25 WCU/RCU)
  read_capacity  = 5
  write_capacity = 5

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "GSI1PK"
    type = "S"
  }
  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI for querying sessions by date across users (admin use)
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
    read_capacity   = 5
    write_capacity  = 5
  }

  # TTL for soft-deleted items (optional cleanup)
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  # Encryption with AWS managed key (free)
  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = false  # Disable to avoid costs; enable in prod if needed
  }

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

output "table_name" { value = aws_dynamodb_table.main.name }
output "table_arn"  { value = aws_dynamodb_table.main.arn }
