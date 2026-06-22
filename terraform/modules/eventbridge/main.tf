# ──────────────────────────────────────────────────────────────────
# Module: EventBridge Scheduler
# Free Tier: 14M scheduler invocations/month (Always Free)
# ──────────────────────────────────────────────────────────────────

variable "project_name"         { type = string }
variable "environment"          { type = string }
variable "daily_summary_lambda_arn"  { type = string }

# IAM Role for EventBridge Scheduler to invoke Lambda
resource "aws_iam_role" "scheduler" {
  name = "${var.project_name}-scheduler-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke_lambda" {
  name = "invoke-daily-summary"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = var.daily_summary_lambda_arn
    }]
  })
}

# Daily summary job — runs every day at 08:00 UTC
resource "aws_scheduler_schedule" "daily_summary" {
  name       = "${var.project_name}-daily-summary-${var.environment}"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "cron(0 8 * * ? *)"

  target {
    arn      = var.daily_summary_lambda_arn
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      source = "eventbridge-scheduler"
      detail = { type = "daily-summary" }
    })

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 3600
    }
  }
}

output "schedule_arn" { value = aws_scheduler_schedule.daily_summary.arn }
