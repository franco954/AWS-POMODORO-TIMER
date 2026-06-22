# ──────────────────────────────────────────────────────────────────
# Module: SQS Queue for session completion events
# Free Tier: 1M requests/month (Always Free)
# ──────────────────────────────────────────────────────────────────

variable "project_name" { type = string }
variable "environment"  { type = string }

resource "aws_sqs_queue" "session_completed_dlq" {
  name                      = "${var.project_name}-session-completed-dlq-${var.environment}"
  message_retention_seconds = 1209600  # 14 days
  tags = { Name = "${var.project_name}-dlq-${var.environment}" }
}

resource "aws_sqs_queue" "session_completed" {
  name                       = "${var.project_name}-session-completed-${var.environment}"
  delay_seconds              = 0
  max_message_size           = 262144  # 256 KB
  message_retention_seconds  = 86400   # 1 day
  receive_wait_time_seconds  = 20      # Long polling (reduces API calls = less cost)
  visibility_timeout_seconds = 60      # Must be >= Lambda timeout

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.session_completed_dlq.arn
    maxReceiveCount     = 3
  })

  # Encryption with AWS managed key (free)
  sqs_managed_sse_enabled = true

  tags = { Name = "${var.project_name}-session-completed-${var.environment}" }
}

output "queue_url"  { value = aws_sqs_queue.session_completed.url }
output "queue_arn"  { value = aws_sqs_queue.session_completed.arn }
output "dlq_arn"    { value = aws_sqs_queue.session_completed_dlq.arn }
