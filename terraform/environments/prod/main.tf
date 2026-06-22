# ──────────────────────────────────────────────────────────────────
# Environment: prod — idéntico al dev con restricciones más estrictas
# ──────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.7.0"
}

locals {
  project_name  = "pomodoro"
  environment   = "prod"
  aws_region    = "us-east-1"
  # CloudFront URL se completa después del primer apply
  cors_origin   = "https://CLOUDFRONT_URL_PROD"
}

module "dynamodb" {
  source       = "../../modules/dynamodb"
  project_name = local.project_name
  environment  = local.environment
}

module "sqs" {
  source       = "../../modules/sqs"
  project_name = local.project_name
  environment  = local.environment
}

module "sns" {
  source       = "../../modules/sns"
  project_name = local.project_name
  environment  = local.environment
}

module "s3_cloudfront" {
  source       = "../../modules/s3_frontend"
  project_name = local.project_name
  environment  = local.environment
}

module "lambda" {
  source       = "../../modules/lambda"
  project_name = local.project_name
  environment  = local.environment
  table_name   = module.dynamodb.table_name
  table_arn    = module.dynamodb.table_arn
  queue_url    = module.sqs.queue_url
  queue_arn    = module.sqs.queue_arn
  topic_arn    = module.sns.topic_arn
  cors_origin  = local.cors_origin
}

module "cognito" {
  source                          = "../../modules/cognito"
  project_name                    = local.project_name
  environment                     = local.environment
  cognito_post_confirmation_arn   = module.lambda.cognito_post_confirmation_arn
}

module "api_gateway" {
  source                        = "../../modules/api_gateway"
  project_name                  = local.project_name
  environment                   = local.environment
  user_pool_id                  = module.cognito.user_pool_id
  user_pool_client_id           = module.cognito.client_id
  create_session_invoke_arn     = module.lambda.create_session_invoke_arn
  complete_session_invoke_arn   = module.lambda.complete_session_invoke_arn
  get_sessions_invoke_arn       = module.lambda.get_sessions_invoke_arn
  get_stats_invoke_arn          = module.lambda.get_stats_invoke_arn
  update_settings_invoke_arn    = module.lambda.update_settings_invoke_arn
  cors_allow_origins            = [local.cors_origin]
}

module "eventbridge" {
  source                    = "../../modules/eventbridge"
  project_name              = local.project_name
  environment               = local.environment
  daily_summary_lambda_arn  = module.lambda.daily_summary_arn
}

output "api_endpoint"      { value = module.api_gateway.api_endpoint }
output "cloudfront_url"    { value = module.s3_cloudfront.cloudfront_url }
output "s3_bucket"         { value = module.s3_cloudfront.s3_bucket_name }
output "cloudfront_id"     { value = module.s3_cloudfront.cloudfront_id }
output "cognito_pool_id"   { value = module.cognito.user_pool_id }
output "cognito_client_id" { value = module.cognito.client_id }
output "dynamodb_table"    { value = module.dynamodb.table_name }
