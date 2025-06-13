use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub dynamodb_endpoint: Option<String>,
    pub trash_bins_table: String,
    pub status_reports_table: String,
    pub aws_region: String,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            dynamodb_endpoint: env::var("DYNAMODB_ENDPOINT_URL").ok(),
            trash_bins_table: env::var("TRASH_BINS_TABLE")
                .unwrap_or_else(|_| "trash-bins".to_string()),
            status_reports_table: env::var("STATUS_REPORTS_TABLE")
                .unwrap_or_else(|_| "status-reports".to_string()),
            aws_region: env::var("AWS_DEFAULT_REGION")
                .unwrap_or_else(|_| "eu-central-1".to_string()),
            log_level: env::var("LOG_LEVEL")
                .unwrap_or_else(|_| "INFO".to_string()),
        }
    }

    pub fn is_local_development(&self) -> bool {
        self.dynamodb_endpoint.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_from_env() {
        env::set_var("TRASH_BINS_TABLE", "test-bins");
        env::set_var("LOG_LEVEL", "DEBUG");
        
        let config = Config::from_env();
        
        assert_eq!(config.trash_bins_table, "test-bins");
        assert_eq!(config.log_level, "DEBUG");
    }

    #[test]
    fn test_local_development_detection() {
        env::set_var("DYNAMODB_ENDPOINT_URL", "http://localhost:4566");
        let config = Config::from_env();
        assert!(config.is_local_development());
        
        env::remove_var("DYNAMODB_ENDPOINT_URL");
        let config = Config::from_env();
        assert!(!config.is_local_development());
    }
}
