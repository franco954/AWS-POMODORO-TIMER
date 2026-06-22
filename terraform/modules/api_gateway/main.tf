# ──────────────────────────────────────────────────────────────────
# Module: API Gateway HTTP API
# Free Tier: 1M calls/month for 12 months
# ──────────────────────────────────────────────────────────────────

variable "project_name"                   { type = string }
variable "environment"                    { type = string }
variable "user_pool_id"                   { type = string }
variable "user_pool_client_id"            { type = string }
variable "create_session_invoke_arn"      { type = string }
variable "complete_session_invoke_arn"    { type = string }
variable "get_sessions_invoke_arn"        { type = string }
variable "get_stats_invoke_arn"           { type = string }
variable "update_settings_invoke_arn"     { type = string }
variable "cors_allow_origins"             { type = list(string) }

data "aws_region" "current" {}

# ── HTTP API ──────────────────────────────────────────────────────
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"
  description   = "Pomodoro Timer API"

  cors_configuration {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

# ── Cognito JWT Authorizer ─────────────────────────────────────────
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [var.user_pool_client_id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${var.user_pool_id}"
  }
}

# ── Stage ─────────────────────────────────────────────────────────
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
      userAgent      = "$context.identity.userAgent"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = 7
}

# ── Lambda Integrations ───────────────────────────────────────────
locals {
  routes = {
    "POST /sessions"         = var.create_session_invoke_arn
    "PUT /sessions/{id}"     = var.complete_session_invoke_arn
    "GET /sessions"          = var.get_sessions_invoke_arn
    "GET /stats"             = var.get_stats_invoke_arn
    "PUT /settings"          = var.update_settings_invoke_arn
    "GET /settings"          = var.update_settings_invoke_arn
  }
}

resource "aws_apigatewayv2_integration" "lambdas" {
  for_each           = local.routes
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = each.value
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each          = local.routes
  api_id            = aws_apigatewayv2_api.main.id
  route_key         = each.key
  target            = "integrations/${aws_apigatewayv2_integration.lambdas[each.key].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ── Lambda permissions: API Gateway → Lambda ──────────────────────
resource "aws_lambda_permission" "api_gw" {
  for_each      = local.routes
  statement_id  = "AllowAPIGW-${replace(each.key, "/[^a-zA-Z0-9]/", "-")}-${var.environment}"
  action        = "lambda:InvokeFunction"
  function_name = split("/functions/", split("/invocations", each.value)[0])[1]
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ── Outputs ───────────────────────────────────────────────────────
output "api_endpoint"  { value = aws_apigatewayv2_api.main.api_endpoint }
output "api_id"        { value = aws_apigatewayv2_api.main.id }
