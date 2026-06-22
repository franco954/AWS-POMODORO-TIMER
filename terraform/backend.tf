# ─────────────────────────────────────────────────────────────────
# Terraform Remote State Backend
# S3 bucket + DynamoDB table for state locking
# ─────────────────────────────────────────────────────────────────
# IMPORTANT: This backend block requires the bucket and DynamoDB table
# to exist BEFORE running terraform init.
# Create them manually once:
#   aws s3 mb s3://pomodoro-tfstate-<account_id> --region us-east-1
#   aws dynamodb create-table \
#     --table-name pomodoro-tfstate-lock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region us-east-1
# ─────────────────────────────────────────────────────────────────

terraform {
  backend "s3" {
    bucket         = "pomodoro-tfstate-832285994602"
    key            = "global/terraform.tfstate" # Will be overridden dynamically per environment during terraform init
    region         = "us-east-1"
    dynamodb_table = "pomodoro-tfstate-lock"
    encrypt        = true
  }
}
