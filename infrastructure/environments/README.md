# Environment Configuration Files

This directory contains Terraform variable files (tfvars) for different environments.

## Files

### Committed Files (Version Controlled)

These files contain **non-sensitive** configuration and should be committed to git:

- **`local.tfvars`** - LocalStack development environment
  - Uses simple bucket names
  - Lower resource limits for local testing
  - Points to LocalStack endpoint

- **`dev.tfvars`** - AWS development environment
  - Uses PAY_PER_REQUEST billing for DynamoDB
  - Higher Lambda memory and timeout
  - Globally unique bucket names

### Ignored Files (Not Version Controlled)

These files can contain **sensitive or personal** overrides and are automatically ignored:

- **`*-override.tfvars`** - Personal overrides for any environment
- **`*-secrets.tfvars`** - Sensitive data (API keys, etc.)

## Usage

### Basic Deployment

```bash
# Deploy with standard environment config
terraform apply -var-file="../../environments/local.tfvars"
```

### With Overrides

```bash
# Copy example and customize
cp override.tfvars.example local-override.tfvars

# Edit your overrides
nano local-override.tfvars

# Deploy with both files (override takes precedence)
terraform apply \
  -var-file="../../environments/local.tfvars" \
  -var-file="../../environments/local-override.tfvars"
```

## Configuration Guidelines

### What to Commit (local.tfvars, dev.tfvars)

✅ **Safe to commit:**
- Environment names
- AWS regions
- Resource configurations (memory, timeouts)
- DynamoDB billing modes
- Bucket name patterns
- Default tags

### What NOT to Commit (use override files)

❌ **Never commit:**
- API keys or secrets
- Personal AWS account IDs
- Custom bucket names with your credentials
- Temporary testing configurations
- Personal tags with your name/email

## Adding a New Environment

1. Copy an existing tfvars file:
   ```bash
   cp dev.tfvars prod.tfvars
   ```

2. Update values for the new environment:
   - Change `environment` name
   - Use production-appropriate settings
   - Ensure globally unique S3 bucket names

3. Create corresponding backend config:
   ```bash
   # In infrastructure/backend/
   cp dev.tfbackend prod.tfbackend
   ```

4. Commit both files:
   ```bash
   git add infrastructure/environments/prod.tfvars
   git add infrastructure/backend/prod.tfbackend
   git commit -m "Add production environment configuration"
   ```

## Best Practices

1. **Use override files for local customization** - Never modify the base tfvars files for personal preferences

2. **Keep sensitive data separate** - Use AWS Secrets Manager or similar for actual secrets, not tfvars files

3. **Document changes** - When adding new variables, update all environment files or use sensible defaults

4. **Review before committing** - Always review tfvars changes to ensure no secrets are included

5. **Use descriptive names** - Make it clear what each variable does with comments

## Variables Reference

### Common Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `environment` | string | Environment name | `"dev"`, `"prod"` |
| `aws_region` | string | AWS region | `"eu-central-1"` |
| `project_name` | string | Project name | `"ecoscan"` |
| `use_localstack` | bool | Use LocalStack | `true`, `false` |

### DynamoDB Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `dynamodb_billing_mode` | string | Billing mode | `"PAY_PER_REQUEST"`, `"PROVISIONED"` |
| `dynamodb_read_capacity` | number | Read capacity (if PROVISIONED) | `5`, `null` |
| `dynamodb_write_capacity` | number | Write capacity (if PROVISIONED) | `5`, `null` |

### Lambda Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `lambda_memory_size` | number | Memory in MB | `128`, `256`, `512` |
| `lambda_timeout` | number | Timeout in seconds | `30`, `60`, `300` |
| `lambda_architecture` | string | CPU architecture | `"x86_64"`, `"arm64"` |
| `lambda_sqs_batch_size` | number | SQS messages per batch | `10` |
| `lambda_max_concurrency` | number | Max concurrent executions | `5`, `100` |

### S3 Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `health_bucket_name` | string | Health check bucket | `"health"` (local), `"ecoscan-dev-health-abc123"` (AWS) |
| `lambda_deployments_bucket_name` | string | Lambda deployment bucket | `"lambda-deployments"` (local) |

## Troubleshooting

### "Bucket already exists" error

S3 bucket names must be globally unique in AWS. Either:
1. Change the bucket name in your tfvars
2. Use an override file with a unique name

### "Variable not declared" warnings

Some variables may only be used in specific layers. These warnings are normal and can be ignored.

### Override file not being used

Make sure to:
1. Include both `-var-file` arguments in correct order (base, then override)
2. Check the override file is in the correct directory
3. Verify the override file has proper Terraform syntax

## Example Workflow

```bash
# 1. Start with base configuration
cd infrastructure/layers/01-data
terraform init -backend-config="../../backend/dev.tfbackend"

# 2. Create your personal overrides (optional)
cd ../../environments
cp override.tfvars.example dev-override.tfvars
nano dev-override.tfvars

# 3. Deploy with your customizations
cd ../layers/01-data
terraform apply \
  -var-file="../../environments/dev.tfvars" \
  -var-file="../../environments/dev-override.tfvars"
```

## Security Note

Even though these tfvars files don't contain secrets, be mindful of:
- Organization-specific naming conventions
- Internal IP ranges or VPC configurations (if added in future)
- Any compliance or regulatory requirements

When in doubt, use override files for anything that could be considered sensitive.

