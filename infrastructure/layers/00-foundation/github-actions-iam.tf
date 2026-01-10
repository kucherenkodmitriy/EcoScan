# GitHub Actions IAM Configuration
# This file creates IAM resources for GitHub Actions deployments

# ============================================================================
# OPTION 1: OIDC Provider and Role (Recommended)
# ============================================================================

# OIDC Provider for GitHub Actions
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]

  tags = {
    Name        = "github-actions-oidc-provider"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# IAM Role for GitHub Actions (OIDC)
resource "aws_iam_role" "github_actions_role" {
  name        = "${var.environment}-${var.project_name}-github-actions-role"
  description = "Role for GitHub Actions to deploy and manage EcoScan infrastructure"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Allow GitHub Actions from main branch and pull requests
            "token.actions.githubusercontent.com:sub" = "repo:kucherenkodmitriy/EcoScan:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-github-actions-role"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ============================================================================
# OPTION 2: IAM User Policy (Alternative - using access keys)
# ============================================================================

# This policy can be attached to the existing GITHUB IAM user
# or to the OIDC role created above

# Comprehensive deployment policy for GitHub Actions
resource "aws_iam_policy" "github_actions_deployment_policy" {
  name        = "${var.environment}-${var.project_name}-github-actions-deployment"
  description = "Comprehensive deployment policy for GitHub Actions to manage EcoScan infrastructure"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3 Permissions
      {
        Sid    = "S3BucketManagement"
        Effect = "Allow"
        Action = [
          "s3:CreateBucket",
          "s3:DeleteBucket",
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:GetBucketVersioning",
          "s3:PutBucketVersioning",
          "s3:GetBucketTagging",
          "s3:PutBucketTagging",
          "s3:GetEncryptionConfiguration",
          "s3:PutEncryptionConfiguration",
          "s3:GetBucketPolicy",
          "s3:PutBucketPolicy",
          "s3:DeleteBucketPolicy",
          "s3:GetBucketAcl",
          "s3:PutBucketAcl",
          "s3:GetBucketCORS",
          "s3:PutBucketCORS",
          "s3:GetBucketPublicAccessBlock",
          "s3:PutBucketPublicAccessBlock",
          "s3:GetBucketWebsite",
          "s3:PutBucketWebsite",
          "s3:DeleteBucketWebsite",
          "s3:GetBucketLogging",
          "s3:PutBucketLogging",
          "s3:GetBucketNotification",
          "s3:PutBucketNotification",
          "s3:GetLifecycleConfiguration",
          "s3:PutLifecycleConfiguration",
          "s3:GetReplicationConfiguration",
          "s3:PutReplicationConfiguration",
          "s3:GetAccelerateConfiguration",
          "s3:PutAccelerateConfiguration",
          "s3:GetBucketRequestPayment",
          "s3:PutBucketRequestPayment",
          "s3:GetBucketOwnershipControls",
          "s3:PutBucketOwnershipControls",
          "s3:GetObjectLockConfiguration",
          "s3:PutObjectLockConfiguration",
          "s3:GetBucketObjectLockConfiguration",
          "s3:PutBucketObjectLockConfiguration",
        ]
        Resource = [
          "arn:aws:s3:::${var.environment}-${var.project_name}-*",
          "arn:aws:s3:::${var.project_name}-${var.environment}-*",
          "arn:aws:s3:::ecoscan-terraform-state-${var.environment}",
        ]
      },
      {
        Sid    = "S3ObjectManagement"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListMultipartUploadParts",
          "s3:AbortMultipartUpload",
          "s3:GetObjectVersion",
          "s3:DeleteObjectVersion",
        ]
        Resource = [
          "arn:aws:s3:::${var.environment}-${var.project_name}-*/*",
          "arn:aws:s3:::${var.project_name}-${var.environment}-*/*",
          "arn:aws:s3:::ecoscan-terraform-state-${var.environment}/*",
        ]
      },
      {
        Sid    = "S3ListAllBuckets"
        Effect = "Allow"
        Action = [
          "s3:ListAllMyBuckets",
          "s3:GetBucketLocation",
        ]
        Resource = "*"
      },
      # DynamoDB Permissions
      {
        Sid    = "DynamoDBManagement"
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable",
          "dynamodb:DeleteTable",
          "dynamodb:DescribeTable",
          "dynamodb:UpdateTable",
          "dynamodb:ListTables",
          "dynamodb:TagResource",
          "dynamodb:UntagResource",
          "dynamodb:ListTagsOfResource",
          "dynamodb:DescribeTimeToLive",
          "dynamodb:UpdateTimeToLive",
          "dynamodb:DescribeContinuousBackups",
          "dynamodb:UpdateContinuousBackups",
        ]
        Resource = [
          "arn:aws:dynamodb:*:*:table/${var.environment}-${var.project_name}-*",
        ]
      },
      # DynamoDB Terraform State Lock Permissions
      {
        Sid    = "DynamoDBTerraformLock"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
        ]
        Resource = [
          "arn:aws:dynamodb:*:*:table/ecoscan-terraform-locks-${var.environment}",
        ]
      },
      # Lambda Permissions
      {
        Sid    = "LambdaManagement"
        Effect = "Allow"
        Action = [
          "lambda:CreateFunction",
          "lambda:DeleteFunction",
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:ListFunctions",
          "lambda:ListVersionsByFunction",
          "lambda:PublishVersion",
          "lambda:CreateAlias",
          "lambda:UpdateAlias",
          "lambda:DeleteAlias",
          "lambda:GetAlias",
          "lambda:TagResource",
          "lambda:UntagResource",
          "lambda:ListTags",
          "lambda:AddPermission",
          "lambda:RemovePermission",
          "lambda:GetPolicy",
          "lambda:PutFunctionConcurrency",
          "lambda:DeleteFunctionConcurrency",
          "lambda:CreateEventSourceMapping",
          "lambda:UpdateEventSourceMapping",
          "lambda:DeleteEventSourceMapping",
          "lambda:GetEventSourceMapping",
          "lambda:ListEventSourceMappings",
        ]
        Resource = [
          "arn:aws:lambda:*:*:function:${var.environment}-${var.project_name}-*",
          "arn:aws:lambda:*:*:event-source-mapping:*",
        ]
      },
      # IAM Permissions (for creating/managing service roles)
      {
        Sid    = "IAMRoleManagement"
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:ListRoles",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:ListRoleTags",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:PassRole",
        ]
        Resource = [
          "arn:aws:iam::*:role/${var.environment}-${var.project_name}-*",
        ]
      },
      {
        Sid    = "IAMPolicyManagement"
        Effect = "Allow"
        Action = [
          "iam:CreatePolicy",
          "iam:DeletePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListPolicies",
          "iam:ListPolicyVersions",
          "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion",
          "iam:TagPolicy",
          "iam:UntagPolicy",
        ]
        Resource = [
          "arn:aws:iam::*:policy/${var.environment}-${var.project_name}-*",
        ]
      },
      # IAM OIDC Provider Permissions (for GitHub Actions)
      {
        Sid    = "IAMOIDCProviderManagement"
        Effect = "Allow"
        Action = [
          "iam:CreateOpenIDConnectProvider",
          "iam:DeleteOpenIDConnectProvider",
          "iam:GetOpenIDConnectProvider",
          "iam:ListOpenIDConnectProviders",
          "iam:TagOpenIDConnectProvider",
          "iam:UntagOpenIDConnectProvider",
          "iam:UpdateOpenIDConnectProviderThumbprint",
        ]
        Resource = [
          "arn:aws:iam::*:oidc-provider/token.actions.githubusercontent.com",
        ]
      },
      # API Gateway Permissions
      {
        Sid    = "APIGatewayManagement"
        Effect = "Allow"
        Action = [
          "apigateway:GET",
          "apigateway:POST",
          "apigateway:PUT",
          "apigateway:PATCH",
          "apigateway:DELETE",
          "apigateway:UpdateRestApiPolicy",
        ]
        Resource = [
          "arn:aws:apigateway:*::/restapis",
          "arn:aws:apigateway:*::/restapis/*",
          "arn:aws:apigateway:*::/tags/*",
        ]
      },
      # SQS Permissions
      {
        Sid    = "SQSManagement"
        Effect = "Allow"
        Action = [
          "sqs:CreateQueue",
          "sqs:DeleteQueue",
          "sqs:GetQueueAttributes",
          "sqs:SetQueueAttributes",
          "sqs:ListQueues",
          "sqs:TagQueue",
          "sqs:UntagQueue",
          "sqs:ListQueueTags",
          "sqs:GetQueueUrl",
        ]
        Resource = [
          "arn:aws:sqs:*:*:${var.environment}-${var.project_name}-*",
        ]
      },
      # CloudWatch Logs Permissions
      {
        Sid    = "CloudWatchLogsManagement"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:DescribeLogGroups",
          "logs:PutRetentionPolicy",
          "logs:DeleteRetentionPolicy",
          "logs:TagLogGroup",
          "logs:UntagLogGroup",
          "logs:ListTagsLogGroup",
          "logs:ListTagsForResource",
          "logs:TagResource",
          "logs:UntagResource",
        ]
        Resource = [
          "arn:aws:logs:*:*:log-group:/aws/lambda/${var.environment}-${var.project_name}-*",
          "arn:aws:logs:*:*:log-group:/aws/lambda/${var.environment}-${var.project_name}-*:*",
          "arn:aws:logs:*:*:log-group:/aws/apigateway/${var.environment}-${var.project_name}*",
          "arn:aws:logs:*:*:log-group:/aws/apigateway/${var.environment}-${var.project_name}*:*",
        ]
      },
      # CloudWatch Logs Describe (requires broader permissions)
      {
        Sid    = "CloudWatchLogsDescribe"
        Effect = "Allow"
        Action = [
          "logs:DescribeLogGroups",
        ]
        Resource = "*"
      },
      # X-Ray Permissions
      {
        Sid    = "XRayPermissions"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
        ]
        Resource = "*"
      },
      # EC2 Permissions (for VPC-based Lambda if needed in future)
      {
        Sid    = "EC2NetworkPermissions"
        Effect = "Allow"
        Action = [
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcs",
          "ec2:DescribeNetworkInterfaces",
        ]
        Resource = "*"
      },
      # CloudFormation (if using SAM or CDK in future)
      {
        Sid    = "CloudFormationRead"
        Effect = "Allow"
        Action = [
          "cloudformation:DescribeStacks",
          "cloudformation:DescribeStackEvents",
          "cloudformation:DescribeStackResources",
        ]
        Resource = "*"
      },
      # STS Permissions (for assuming roles and getting caller identity)
      {
        Sid    = "STSPermissions"
        Effect = "Allow"
        Action = [
          "sts:GetCallerIdentity",
        ]
        Resource = "*"
      },
    ]
  })

  tags = {
    Name        = "${var.project_name}-github-actions-deployment"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ============================================================================
# Attach policy to OIDC Role (Option 1)
# ============================================================================

resource "aws_iam_role_policy_attachment" "github_actions_role_policy" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.github_actions_deployment_policy.arn
}

# Additional policy for extra permissions (split due to size limits)
resource "aws_iam_policy" "github_actions_extra_policy" {
  name        = "${var.environment}-${var.project_name}-github-actions-extra"
  description = "Additional permissions for GitHub Actions (split policy)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # API Gateway Extended Resources
      {
        Sid    = "APIGatewayExtended"
        Effect = "Allow"
        Action = [
          "apigateway:GET",
          "apigateway:POST",
          "apigateway:PUT",
          "apigateway:PATCH",
          "apigateway:DELETE",
        ]
        Resource = [
          "arn:aws:apigateway:*::/usageplans",
          "arn:aws:apigateway:*::/usageplans/*",
          "arn:aws:apigateway:*::/apikeys",
          "arn:aws:apigateway:*::/apikeys/*",
          "arn:aws:apigateway:*::/account",
        ]
      },
      # Lambda Extended Permissions
      {
        Sid    = "LambdaExtended"
        Effect = "Allow"
        Action = [
          "lambda:GetFunctionCodeSigningConfig",
          "lambda:PutFunctionCodeSigningConfig",
          "lambda:DeleteFunctionCodeSigningConfig",
        ]
        Resource = [
          "arn:aws:lambda:*:*:function:${var.environment}-${var.project_name}-*",
        ]
      },
    ]
  })

  tags = {
    Name        = "${var.project_name}-github-actions-extra"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "github_actions_role_extra_policy" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.github_actions_extra_policy.arn
}

# ============================================================================
# Attach policy to existing GITHUB user (Option 2)
# ============================================================================

# Uncomment this to attach the policy to the existing GITHUB IAM user
# data "aws_iam_user" "github" {
#   user_name = "GITHUB"
# }
#
# resource "aws_iam_user_policy_attachment" "github_user_policy" {
#   user       = data.aws_iam_user.github.user_name
#   policy_arn = aws_iam_policy.github_actions_deployment_policy.arn
# }

# ============================================================================
# Outputs
# ============================================================================

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions OIDC role (use this in GitHub secrets as AWS_ROLE_ARN)"
  value       = aws_iam_role.github_actions_role.arn
}

output "github_actions_policy_arn" {
  description = "ARN of the GitHub Actions deployment policy"
  value       = aws_iam_policy.github_actions_deployment_policy.arn
}
