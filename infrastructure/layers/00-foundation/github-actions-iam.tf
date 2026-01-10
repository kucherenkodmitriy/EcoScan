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
        ]
        Resource = [
          "arn:aws:s3:::${var.environment}-${var.project_name}-*",
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
        ]
        Resource = [
          "arn:aws:logs:*:*:log-group:/aws/lambda/${var.environment}-${var.project_name}-*",
          "arn:aws:logs:*:*:log-group:/aws/apigateway/${var.environment}-${var.project_name}*",
        ]
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
