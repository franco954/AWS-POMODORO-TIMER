# ──────────────────────────────────────────────────────────────────
# Module: Lambda Functions
# Free Tier: 1M requests + 400K GB-seconds/month (Always Free)
# ──────────────────────────────────────────────────────────────────

variable "project_name"  { type = string }
variable "environment"   { type = string }
variable "table_name"    { type = string }
variable "table_arn"     { type = string }
variable "queue_url"     { type = string }
variable "queue_arn"     { type = string }
variable "topic_arn"     { type = string }
variable "cors_origin"   { type = string }

locals {
  lambda_runtime    = "nodejs20.x"
  lambda_timeout    = 10       # seconds
  lambda_memory     = 128      # MB — minimum, keeps costs at $0
  lambdas_src_path  = "${path.module}/../../../backend/lambdas"

  # Common environment variables for all Lambdas
  common_env = {
    DYNAMODB_TABLE = var.table_name
    ENVIRONMENT    = var.environment
    CORS_ORIGIN    = var.cors_origin
    SNS_TOPIC_ARN  = var.topic_arn
    SQS_QUEUE_URL  = var.queue_url
    NODE_OPTIONS   = "--enable-source-maps"
    LOG_LEVEL      = var.environment == "prod" ? "warn" : "debug"
  }

  # All Lambda functions share this layer
  shared_layer_arns = [aws_lambda_layer_version.shared_utils.arn]
}

# ── IAM: Base execution role (shared) ────────────────────────────
resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "xray" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# ── IAM: DynamoDB policy ──────────────────────────────────────────
resource "aws_iam_role_policy" "dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
      ]
      Resource = [var.table_arn, "${var.table_arn}/index/*"]
    }]
  })
}

# ── IAM: SQS policy ──────────────────────────────────────────────
resource "aws_iam_role_policy" "sqs" {
  name = "sqs-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
      ]
      Resource = var.queue_arn
    }]
  })
}

# ── IAM: SNS policy ──────────────────────────────────────────────
resource "aws_iam_role_policy" "sns" {
  name = "sns-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sns:Publish"]
      Resource = var.topic_arn
    }]
  })
}

# ── Lambda Layer: shared utilities ───────────────────────────────
# The layer exposes utils.mjs at /opt/nodejs/utils.mjs inside each Lambda
data "archive_file" "shared_utils_layer" {
  type        = "zip"
  output_path = "${path.module}/.dist/shared_utils_layer.zip"

  source {
    content  = file("${local.lambdas_src_path}/shared/utils.mjs")
    filename = "nodejs/utils.mjs"
  }
}

resource "aws_lambda_layer_version" "shared_utils" {
  layer_name          = "${var.project_name}-shared-utils-${var.environment}"
  filename            = data.archive_file.shared_utils_layer.output_path
  source_code_hash    = data.archive_file.shared_utils_layer.output_base64sha256
  compatible_runtimes = ["nodejs20.x"]
  description         = "Shared utility functions (DynamoDB helpers, response helpers, logger)"
}

# ── Helper: Zip each Lambda ───────────────────────────────────────
data "archive_file" "create_session" {
  type        = "zip"
  source_dir  = "${local.lambdas_src_path}/create_session"
  output_path = "${path.module}/.dist/create_session.zip"
}
data "archive_file" "complete_session" {
  type        = "zip"
  source_dir  = "${local.lambdas_src_path}/complete_session"
  output_path = "${path.module}/.dist/complete_session.zip"
}
data "archive_file" "get_sessions" {
  type        = "zip"
  source_dir  = "${local.lambdas_src_path}/get_sessions"
  output_path = "${path.module}/.dist/get_sessions.zip"
}
data "archive_file" "get_stats" {
  type        = "zip"
  source_dir  = "${local.lambdas_src_path}/get_stats"
  output_path = "${path.module}/.dist/get_stats.zip"
}
data "archive_file" "update_settings" {
  type        = "zip"
  source_dir  = "${local.lambdas_src_path}/update_settings"
  output_path = "${path.module}/.dist/update_settings.zip"
}
data "archive_file" "notification_processor" {
  type        = "zip"
  source_dir  = "${local.lambdas_src_path}/notification_processor"
  output_path = "${path.module}/.dist/notification_processor.zip"
}
data "archive_file" "daily_summary" {
  type        = "zip"
  source_dir  = "${local.lambdas_src_path}/daily_summary"
  output_path = "${path.module}/.dist/daily_summary.zip"
}
data "archive_file" "cognito_post_confirmation" {
  type        = "zip"
  source_dir  = "${local.lambdas_src_path}/cognito_post_confirmation"
  output_path = "${path.module}/.dist/cognito_post_confirmation.zip"
}

# ── Lambda Function Factory ───────────────────────────────────────
resource "aws_lambda_function" "create_session" {
  function_name    = "${var.project_name}-create-session-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = local.lambda_memory
  filename         = data.archive_file.create_session.output_path
  source_code_hash = data.archive_file.create_session.output_base64sha256
  layers           = local.shared_layer_arns
  tracing_config { mode = "Active" }
  environment { variables = local.common_env }
}

resource "aws_lambda_function" "complete_session" {
  function_name    = "${var.project_name}-complete-session-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = local.lambda_memory
  filename         = data.archive_file.complete_session.output_path
  source_code_hash = data.archive_file.complete_session.output_base64sha256
  layers           = local.shared_layer_arns
  tracing_config { mode = "Active" }
  environment { variables = local.common_env }
}

resource "aws_lambda_function" "get_sessions" {
  function_name    = "${var.project_name}-get-sessions-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = local.lambda_memory
  filename         = data.archive_file.get_sessions.output_path
  source_code_hash = data.archive_file.get_sessions.output_base64sha256
  layers           = local.shared_layer_arns
  tracing_config { mode = "Active" }
  environment { variables = local.common_env }
}

resource "aws_lambda_function" "get_stats" {
  function_name    = "${var.project_name}-get-stats-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = local.lambda_memory
  filename         = data.archive_file.get_stats.output_path
  source_code_hash = data.archive_file.get_stats.output_base64sha256
  layers           = local.shared_layer_arns
  tracing_config { mode = "Active" }
  environment { variables = local.common_env }
}

resource "aws_lambda_function" "update_settings" {
  function_name    = "${var.project_name}-update-settings-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = local.lambda_memory
  filename         = data.archive_file.update_settings.output_path
  source_code_hash = data.archive_file.update_settings.output_base64sha256
  layers           = local.shared_layer_arns
  tracing_config { mode = "Active" }
  environment { variables = local.common_env }
}

resource "aws_lambda_function" "notification_processor" {
  function_name    = "${var.project_name}-notification-processor-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  timeout          = 30
  memory_size      = local.lambda_memory
  filename         = data.archive_file.notification_processor.output_path
  source_code_hash = data.archive_file.notification_processor.output_base64sha256
  layers           = local.shared_layer_arns
  tracing_config { mode = "Active" }
  environment { variables = local.common_env }
}

resource "aws_lambda_function" "daily_summary" {
  function_name    = "${var.project_name}-daily-summary-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  timeout          = 60
  memory_size      = local.lambda_memory
  filename         = data.archive_file.daily_summary.output_path
  source_code_hash = data.archive_file.daily_summary.output_base64sha256
  layers           = local.shared_layer_arns
  tracing_config { mode = "Active" }
  environment { variables = local.common_env }
}

resource "aws_lambda_function" "cognito_post_confirmation" {
  function_name    = "${var.project_name}-cognito-post-confirmation-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = local.lambda_memory
  filename         = data.archive_file.cognito_post_confirmation.output_path
  source_code_hash = data.archive_file.cognito_post_confirmation.output_base64sha256
  layers           = local.shared_layer_arns
  tracing_config { mode = "Active" }
  environment { variables = local.common_env }
}

# ── SQS Event Source Mapping ──────────────────────────────────────
resource "aws_lambda_event_source_mapping" "sqs_notification" {
  event_source_arn = var.queue_arn
  function_name    = aws_lambda_function.notification_processor.arn
  batch_size       = 5
  enabled          = true
}

# ── CloudWatch Log Groups (with short retention to avoid costs) ───
resource "aws_cloudwatch_log_group" "lambdas" {
  for_each = toset([
    "${var.project_name}-create-session-${var.environment}",
    "${var.project_name}-complete-session-${var.environment}",
    "${var.project_name}-get-sessions-${var.environment}",
    "${var.project_name}-get-stats-${var.environment}",
    "${var.project_name}-update-settings-${var.environment}",
    "${var.project_name}-notification-processor-${var.environment}",
    "${var.project_name}-daily-summary-${var.environment}",
    "${var.project_name}-cognito-post-confirmation-${var.environment}",
  ])
  name              = "/aws/lambda/${each.key}"
  retention_in_days = 7  # Short retention to minimize storage costs
}

# ── Outputs ───────────────────────────────────────────────────────
output "create_session_invoke_arn"         { value = aws_lambda_function.create_session.invoke_arn }
output "complete_session_invoke_arn"        { value = aws_lambda_function.complete_session.invoke_arn }
output "get_sessions_invoke_arn"           { value = aws_lambda_function.get_sessions.invoke_arn }
output "get_stats_invoke_arn"              { value = aws_lambda_function.get_stats.invoke_arn }
output "update_settings_invoke_arn"        { value = aws_lambda_function.update_settings.invoke_arn }
output "daily_summary_arn"                { value = aws_lambda_function.daily_summary.arn }
output "cognito_post_confirmation_arn"     { value = aws_lambda_function.cognito_post_confirmation.arn }
output "cognito_post_confirmation_fn_name" { value = aws_lambda_function.cognito_post_confirmation.function_name }
