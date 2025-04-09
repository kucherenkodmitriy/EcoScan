# EcoScan CZ

EcoScan CZ is an MVP web application for monitoring the fullness of city trash bins. The application allows administrators to generate QR codes for specific trash bin locations and citizens to report bin status ("Full" or "OK").

## Features

- **Authentication & Authorization**
  - Role-based access: Admin and Member roles
  - Secure login with AWS Cognito

- **Admin Dashboard**
  - QR code generation and management
  - Location management with Google Maps integration
  - Trash bin status monitoring
  - Trash bin creation and management

- **Public Access**
  - QR code scanning for status reporting
  - Simple interface for status updates

## Technology Stack

- **Frontend**: React with TypeScript
- **Backend**: AWS Amplify, Lambda, API Gateway
- **Database**: DynamoDB
- **Authentication**: AWS Cognito
- **Hosting**: AWS Amplify
- **Maps**: Google Maps API

## Setup and Installation

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- AWS account
- AWS CLI configured
- Amplify CLI installed

### Installation Steps

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/ecoscan-cz.git
   cd ecoscan-cz
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Initialize Amplify:
   ```
   amplify init
   ```

4. Deploy the backend:
   ```
   amplify push
   ```

5. Start the development server:
   ```
   npm start
   ```

## Testing

- Run unit tests:
  ```
  npm test
  ```

- Run E2E tests:
  ```
  npm run test:e2e
  ```

## Deployment

The application is deployed through AWS Amplify Console:

1. Connect GitHub repository to Amplify Console
2. Set up branch-based deployment
3. Configure build settings
4. Deploy

## License

Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0), allowing free use, distribution, and adaptation, but prohibiting commercial use without explicit permission. 