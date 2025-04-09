# EcoScan CZ - AWS Infrastructure

This directory contains the AWS infrastructure setup for the EcoScan CZ application.

## Architecture Overview

EcoScan CZ uses the following AWS services:

- **AWS Amplify**: Hosting for the React frontend and authentication
- **Amazon Cognito**: User management and authentication
- **AWS Lambda**: Serverless backend functions
- **Amazon API Gateway**: REST API endpoints
- **Amazon DynamoDB**: NoSQL database for data storage
- **Amazon CloudWatch**: Monitoring and logging
- **AWS CloudFormation**: Infrastructure as Code (IaC)

## Prerequisites

- AWS CLI installed and configured
- AWS Account with appropriate permissions
- Node.js and npm installed

## Setting Up the Infrastructure

### 1. Deploy CloudFormation Stack

```bash
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name ecoscan-cz \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment=dev \
    ApiName=EcoScanAPI \
    CognitoUserPoolName=EcoScanUserPool
```

### 2. Configure Amplify

```bash
# Initialize Amplify
amplify init

# Add authentication
amplify add auth

# Add API
amplify add api

# Add hosting
amplify add hosting

# Push configuration to the cloud
amplify push
```

## Resources Created

### DynamoDB Tables

1. **Locations Table**
   - Primary Key: `id` (String)
   - Attributes: `name`, `address`, `latitude`, `longitude`, `createdAt`, `updatedAt`

2. **TrashBins Table**
   - Primary Key: `id` (String)
   - Attributes: `name`, `locationId`, `qrCodeId`, `status`, `lastUpdated`, `createdAt`, `updatedAt`
   - Global Secondary Index: `locationId-index` (for querying bins by location)

3. **QRCodes Table**
   - Primary Key: `id` (String)
   - Attributes: `url`, `binId`, `createdAt`
   - Global Secondary Index: `binId-index` (for querying QR codes by bin)

4. **StatusUpdates Table**
   - Primary Key: `id` (String)
   - Sort Key: `timestamp` (String)
   - Attributes: `binId`, `status`
   - Global Secondary Index: `binId-timestamp-index` (for querying updates by bin)

### API Gateway Endpoints

- `/locations` - CRUD operations for locations
- `/bins` - CRUD operations for trash bins
- `/bins/{id}/status` - Update trash bin status
- `/qrcodes` - CRUD operations for QR codes
- `/status-updates` - Read status update history

### Lambda Functions

- **CreateLocation** - Creates a new location
- **GetLocations** - Retrieves all locations
- **GetLocation** - Retrieves a specific location
- **UpdateLocation** - Updates a location
- **DeleteLocation** - Deletes a location
- **CreateTrashBin** - Creates a new trash bin
- **GetTrashBins** - Retrieves all trash bins
- **GetTrashBin** - Retrieves a specific trash bin
- **UpdateTrashBin** - Updates a trash bin
- **DeleteTrashBin** - Deletes a trash bin
- **UpdateBinStatus** - Updates trash bin status and creates status update record
- **GenerateQRCode** - Generates a new QR code for a bin
- **GetQRCodes** - Retrieves all QR codes
- **GetQRCode** - Retrieves a specific QR code
- **DeleteQRCode** - Deletes a QR code
- **GetStatusUpdates** - Retrieves status updates for a bin

### Cognito User Pool

- User pool with two groups: `admin` and `member`
- Email verification
- Password policies

## Environment Variables

The following environment variables are needed for the frontend application:

```
REACT_APP_AWS_REGION=eu-central-1
REACT_APP_USER_POOL_ID=your-user-pool-id
REACT_APP_USER_POOL_CLIENT_ID=your-client-id
REACT_APP_API_ENDPOINT=your-api-endpoint
REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

## CI/CD Pipeline

The project uses AWS Amplify Console for continuous integration and deployment:

1. Connect GitHub repository to Amplify Console
2. Configure build settings
3. Set up branch-based deployment

## Security Considerations

- API Gateway endpoints are secured with Cognito authorizers
- Lambda functions follow the principle of least privilege
- Environment variables are stored securely
- Input validation is implemented in Lambda functions

## Cost Management

- DynamoDB tables use on-demand capacity mode for cost optimization
- Lambda functions are configured with appropriate memory and timeout settings
- CloudWatch alarms are set up for cost monitoring

## Troubleshooting

- Check CloudWatch Logs for Lambda function errors
- Verify Cognito user pool and app client settings
- Ensure API Gateway CORS settings are properly configured 