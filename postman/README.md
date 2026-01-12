# EcoScan Postman Collection

API collection for testing EcoScan endpoints.

## API Documentation

See the full OpenAPI specification: [`docs/openapi.yaml`](../docs/openapi.yaml)

You can view it interactively using:
- [Swagger Editor](https://editor.swagger.io/) - Paste the YAML content
- [Swagger UI](https://petstore.swagger.io/) - Use URL to openapi.yaml
- VS Code with OpenAPI extension

## Files

- `EcoScan.postman_collection.json` - API collection with all endpoints
- `Local.postman_environment.json` - Environment for LocalStack
- `AWS-Dev.postman_environment.json` - Environment for AWS dev

## Import

1. Open Postman
2. Click **Import** button
3. Select all JSON files from this folder
4. Collection and environments will be imported

## Setup

### Local Environment

1. Deploy LocalStack: `make local-up`
2. Get API Gateway ID:
   ```bash
   cd infrastructure/layers/03-api
   terraform output -raw api_gateway_id
   ```
3. In Postman, select **EcoScan - Local** environment
4. Update `api_gateway_id` variable with the value from step 2

### AWS Dev Environment

1. In Postman, select **EcoScan - AWS Dev** environment
2. Set `admin_password` to your password (from `seed-data.sh` output)

## Usage

1. **Select environment** from dropdown (top-right)
2. **Run Login request** - JWT token is automatically saved
3. **Use admin endpoints** - Authorization header is auto-populated

## Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | None | Get JWT token |
| POST | `/bins/{id}/status` | None | Report bin status (IoT) |
| GET | `/admin/bins` | JWT | List all bins |
| GET | `/admin/bins/{id}` | JWT | Get bin details |
| POST | `/admin/bins` | JWT | Create new bin |
| PUT | `/admin/bins/{id}` | JWT | Update bin |
| DELETE | `/admin/bins/{id}` | JWT | Delete bin |

## Test Credentials (Local)

- **Email:** admin@ecoscan.local
- **Password:** admin123
