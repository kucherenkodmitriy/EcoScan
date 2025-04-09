// AWS configuration for Amplify v5
export const awsExports = {
  // Global AWS configuration
  aws_project_region: process.env.REACT_APP_AWS_REGION || 'eu-central-1',
  
  // Auth configuration
  aws_cognito_region: process.env.REACT_APP_AWS_REGION || 'eu-central-1',
  aws_user_pools_id: process.env.REACT_APP_USER_POOL_ID || 'eu-central-1_XXXXXXXX',
  aws_user_pools_web_client_id: process.env.REACT_APP_USER_POOL_CLIENT_ID || 'your-client-id',
  aws_mandatory_sign_in: 'enable',
  
  // API configuration
  aws_cloud_logic_custom: [
    {
      name: 'ecoscanAPI',
      endpoint: process.env.REACT_APP_API_ENDPOINT || 'https://api.example.com',
      region: process.env.REACT_APP_AWS_REGION || 'eu-central-1',
    },
  ],
};

// Import this file in index.tsx to ensure configuration happens before components render 