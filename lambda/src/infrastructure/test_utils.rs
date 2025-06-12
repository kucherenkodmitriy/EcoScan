use std::env;

pub fn setup_localstack_env() {
    env::set_var("DYNAMODB_ENDPOINT_URL", "http://localhost:4566");
    env::set_var("AWS_ACCESS_KEY_ID", "test");
    env::set_var("AWS_SECRET_ACCESS_KEY", "test");
    env::set_var("AWS_DEFAULT_REGION", "eu-central-1");
    env::set_var("TRASH_BINS_TABLE", "trash-bins");
    env::set_var("STATUS_REPORTS_TABLE", "status-reports");
} 