use std::env;

/// Set up the test environment for LocalStack
/// 
/// This function configures the necessary environment variables
/// to connect to a LocalStack instance running locally.
pub fn setup_localstack_env() {
    // AWS SDK configuration
    env::set_var("AWS_ACCESS_KEY_ID", "test");
    env::set_var("AWS_SECRET_ACCESS_KEY", "test");
    env::set_var("AWS_DEFAULT_REGION", "eu-central-1");
    env::set_var("AWS_REGION", "eu-central-1");
    
    // LocalStack specific settings
    env::set_var("AWS_ENDPOINT_URL", "http://localhost:4566");
    env::set_var("DYNAMODB_ENDPOINT_URL", "http://localhost:4566");
    
    // Disable EC2 metadata service for local testing
    env::set_var("AWS_EC2_METADATA_DISABLED", "true");
    
    // Table names
    env::set_var("TRASH_BINS_TABLE", "trash-bins");
    env::set_var("STATUS_REPORTS_TABLE", "status-reports");
    
    // Additional AWS SDK configuration for LocalStack
    env::set_var("AWS_EC2_METADATA_SERVICE_ENDPOINT", "http://localhost:4566");
    env::set_var("AWS_STS_REGIONAL_ENDPOINTS", "legacy");
    env::set_var("AWS_SDK_LOAD_CONFIG", "1");
}