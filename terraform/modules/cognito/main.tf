# ──────────────────────────────────────────────────────────────────
# Module: Cognito User Pool
# Free Tier: 50,000 MAU (Always Free)
# ──────────────────────────────────────────────────────────────────

variable "project_name"                    { type = string }
variable "environment"                     { type = string }
variable "cognito_post_confirmation_arn"   { type = string }

# ── User Pool ──────────────────────────────────────────────────────
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}"

  # Allow users to sign in with email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  # Email verification message
  verification_message_template {
    default_email_option  = "CONFIRM_WITH_CODE"
    email_subject         = "🍅 Verifica tu cuenta Pomodoro"
    email_message         = "Tu código de verificación es: {####}"
  }

  # User attributes
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    string_attribute_constraints {
      min_length = 5
      max_length = 254
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 100
    }
  }

  # Trigger: Initialize user in DynamoDB after confirmation
  lambda_config {
    post_confirmation = var.cognito_post_confirmation_arn
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = {
    Name = "${var.project_name}-user-pool-${var.environment}"
  }
}

# ── User Pool Client (for frontend SPA) ───────────────────────────
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-web-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # Public client — no client secret (SPA)
  generate_secret = false

  # Token validity
  access_token_validity  = 1   # 1 hour
  id_token_validity      = 1   # 1 hour
  refresh_token_validity = 30  # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Auth flows allowed for SPA
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  # OAuth settings (not needed for direct auth, but good to configure)
  prevent_user_existence_errors = "ENABLED"

  read_attributes  = ["email", "name", "email_verified"]
  write_attributes = ["email", "name"]
}

# ── Lambda permission: Cognito can invoke the post_confirmation Lambda ──
resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.cognito_post_confirmation_arn
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# ── Outputs ────────────────────────────────────────────────────────
output "user_pool_id"     { value = aws_cognito_user_pool.main.id }
output "user_pool_arn"    { value = aws_cognito_user_pool.main.arn }
output "client_id"        { value = aws_cognito_user_pool_client.web.id }
output "user_pool_domain" { value = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.main.id}" }

data "aws_region" "current" {}
