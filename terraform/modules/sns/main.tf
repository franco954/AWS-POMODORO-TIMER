# ──────────────────────────────────────────────────────────────────
# Module: SNS Topic (for future email notifications / daily summary)
# Free Tier: 1M API requests/month (Always Free)
# ──────────────────────────────────────────────────────────────────

variable "project_name" { type = string }
variable "environment"  { type = string }

resource "aws_sns_topic" "notifications" {
  name = "${var.project_name}-notifications-${var.environment}"

  # Encryption with AWS managed key (free)
  kms_master_key_id = "alias/aws/sns"

  tags = { Name = "${var.project_name}-notifications-${var.environment}" }
}

# Topic policy - allow Lambda to publish
resource "aws_sns_topic_policy" "default" {
  arn = aws_sns_topic.notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "SNS:Publish"
        Resource  = aws_sns_topic.notifications.arn
      }
    ]
  })
}

output "topic_arn"  { value = aws_sns_topic.notifications.arn }
output "topic_name" { value = aws_sns_topic.notifications.name }
