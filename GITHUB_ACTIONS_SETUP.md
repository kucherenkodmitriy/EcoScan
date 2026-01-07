# GitHub Actions IAM Setup

This document describes the IAM permissions configured for GitHub Actions to deploy and manage the EcoScan infrastructure.

## Created Resources

### 1. OIDC Provider (Recommended)
- **Provider URL**: `https://token.actions.githubusercontent.com`
- **Purpose**: Enables GitHub Actions to authenticate with AWS without storing long-term credentials

### 2. IAM Role for GitHub Actions
- **Role ARN**: `arn:aws:iam::019891040755:role/dev-ecoscan-github-actions-role`
- **Role Name**: `dev-ecoscan-github-actions-role`
- **Purpose**: Role that GitHub Actions assumes via OIDC

### 3. Deployment Policy
- **Policy ARN**: `arn:aws:iam::019891040755:policy/dev-ecoscan-github-actions-deployment`
- **Policy Name**: `dev-ecoscan-github-actions-deployment`

## Permissions Granted

The deployment policy grants the following permissions to manage all EcoScan resources:

### S3
- Create, delete, and manage buckets
- Upload, download, and delete objects
- Manage bucket policies, encryption, and versioning
- Access to Terraform state bucket

### DynamoDB
- Create, delete, and manage tables
- Update table configurations
- Manage tags and backups

### Lambda
- Create, delete, and update functions
- Manage function configurations and versions
- Create and manage event source mappings (SQS triggers)
- Upload deployment packages

### IAM
- Create and manage roles for Lambda and API Gateway
- Create and manage policies
- Attach/detach policies to roles
- PassRole permission for service roles

### API Gateway
- Full management of REST APIs
- Create, update, delete API resources
- Manage deployments and stages

### SQS
- Create and delete queues
- Manage queue attributes
- Configure dead letter queues

### CloudWatch Logs
- Create and manage log groups
- Set retention policies

### X-Ray
- Send trace data for distributed tracing

### Other
- EC2 network describe permissions (for VPC Lambda if needed)
- STS GetCallerIdentity
- CloudFormation describe operations (for SAM/CDK if needed)

## GitHub Actions Setup

### Option 1: OIDC (Recommended)

1. **Add the Role ARN to GitHub Secrets**:
   - Go to your repository: `https://github.com/kucherenkodmitriy/EcoScan`
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `AWS_ROLE_ARN`
   - Value: `arn:aws:iam::019891040755:role/dev-ecoscan-github-actions-role`

2. **Your workflow is already configured** to use OIDC in `.github/workflows/deploy-dev.yml`:
   ```yaml
   - name: Configure AWS credentials
     uses: aws-actions/configure-aws-credentials@v4
     with:
       role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
       aws-region: ${{ env.AWS_REGION }}
       role-session-name: GitHubActions-Deploy
   ```

3. **Benefits of OIDC**:
   - No long-term credentials stored in GitHub
   - Automatic credential rotation
   - More secure than access keys
   - Follows AWS best practices

### Option 2: IAM User with Access Keys (Alternative)

If you prefer to use the existing `GITHUB` IAM user with access keys:

1. The deployment policy can be attached to the GITHUB user by uncommenting the code in:
   `infrastructure/layers/00-foundation/github-actions-iam.tf`

2. Then run:
   ```bash
   terraform apply
   ```

3. Create access keys for the GITHUB user and add them to GitHub Secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

## Resource Naming Pattern

All resources follow the naming pattern: `{environment}-{project_name}-*`

For the dev environment:
- S3 buckets: `dev-ecoscan-*`
- DynamoDB tables: `dev-ecoscan-*`
- Lambda functions: `dev-ecoscan-*`
- SQS queues: `dev-ecoscan-*`
- IAM roles: `dev-ecoscan-*`
- API Gateway: `dev-ecoscan-api`

## Security Considerations

1. **Least Privilege**: The policy grants permissions only to resources with the project prefix
2. **Resource Boundaries**: Permissions are scoped to `dev-ecoscan-*` resources
3. **OIDC Trust**: The role can only be assumed by the `kucherenkodmitriy/EcoScan` repository
4. **No Destructive Global Permissions**: No permissions to delete resources outside the project scope

## Terraform State

The GitHub Actions role has permissions to:
- Read/write to the Terraform state bucket: `ecoscan-terraform-state-dev`
- Manage state locking via DynamoDB (if configured)

## Testing Deployment

To test the GitHub Actions deployment:

1. Push changes to the `main` branch
2. Monitor the workflow run in GitHub Actions
3. Check CloudWatch Logs for deployment progress
4. Verify resources are created/updated in AWS Console

## Troubleshooting

### Permission Denied Errors

If you encounter permission denied errors:

1. Check the resource naming matches the pattern: `dev-ecoscan-*`
2. Verify the OIDC trust policy allows your repository
3. Check AWS CloudTrail for detailed permission errors
4. Ensure the policy is attached to the role

### OIDC Authentication Errors

If OIDC authentication fails:

1. Verify the `AWS_ROLE_ARN` secret is set correctly
2. Check the repository name in the trust policy matches exactly
3. Ensure the GitHub Actions workflow has the correct permissions:
   ```yaml
   permissions:
     id-token: write
     contents: read
   ```

## Updating Permissions

To add new permissions:

1. Edit `infrastructure/layers/00-foundation/github-actions-iam.tf`
2. Update the policy statements in `aws_iam_policy.github_actions_deployment_policy`
3. Run:
   ```bash
   cd infrastructure/layers/00-foundation
   terraform plan -var-file="../../environments/dev.tfvars"
   terraform apply -var-file="../../environments/dev.tfvars"
   ```

## Repository Configuration Status

✅ OIDC Provider created
✅ IAM Role created with trust policy for `kucherenkodmitriy/EcoScan`
✅ Deployment policy created and attached
⚠️  **Action Required**: Add `AWS_ROLE_ARN` secret to GitHub repository

Once the GitHub secret is added, your GitHub Actions workflows will be able to deploy and manage all EcoScan infrastructure automatically.
