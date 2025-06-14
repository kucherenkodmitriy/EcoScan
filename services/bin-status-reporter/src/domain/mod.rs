//! Domain models and business logic for the bin-status-reporter service

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::fmt;
use async_trait::async_trait;

pub mod error;
pub use error::AppError;
pub type Result<T> = error::Result<T>;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct BinStatus {
    value: i32,
}

impl BinStatus {
    pub fn new(value: i32) -> Result<Self> {
        if value < 0 || value > 10 {
            return Err(AppError::ValidationError(format!(
                "Bin status must be between 0 and 10, got {}",
                value
            )));
        }
        Ok(Self { value })
    }

    pub fn value(&self) -> i32 {
        self.value
    }

    // Convenience methods for common values
    pub fn empty() -> Self {
        Self { value: 0 }
    }

    pub fn ok() -> Self {
        Self { value: 5 }
    }

    pub fn full() -> Self {
        Self { value: 10 }
    }
}

impl fmt::Display for BinStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.value {
            0 => write!(f, "Empty"),
            10 => write!(f, "Full"),
            _ => write!(f, "{}%", self.value * 10),
        }
    }
}

impl From<i32> for BinStatus {
    fn from(value: i32) -> Self {
        Self { 
            value: value.clamp(0, 10)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Location {
    pub id: Uuid,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrashBin {
    pub id: Uuid,
    pub name: String,
    pub location_id: Uuid,
    pub qr_code_id: Uuid,
    pub status: BinStatus,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QRCode {
    pub id: Uuid,
    pub url: String,
    pub trash_bin_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusUpdateRequest {
    pub bin_id: Uuid,
    pub status: BinStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusUpdateResponse {
    pub success: bool,
    pub message: String,
    pub updated_at: DateTime<Utc>,
}

#[async_trait]
pub trait BinRepository: Send + Sync + 'static {
    async fn update_status(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<()>;

    async fn add_report(
        &self,
        bin_id: &Uuid,
        status: BinStatus,
        timestamp: DateTime<Utc>,
    ) -> Result<()>;
}

#[cfg(test)]
mod tests {
    use super::*;

    mod bin_status_tests {
        use super::*;

        #[test]
        fn test_bin_status_new_valid_values() {
            assert!(BinStatus::new(0).is_ok());
            assert!(BinStatus::new(5).is_ok());
            assert!(BinStatus::new(10).is_ok());
            
            let status = BinStatus::new(7).unwrap();
            assert_eq!(status.value(), 7);
        }

        #[test]
        fn test_bin_status_new_invalid_values() {
            assert!(BinStatus::new(-1).is_err());
            assert!(BinStatus::new(11).is_err());
            assert!(BinStatus::new(-100).is_err());
            assert!(BinStatus::new(100).is_err());
        }

        #[test]
        fn test_bin_status_error_messages() {
            match BinStatus::new(-1) {
                Err(AppError::ValidationError(msg)) => {
                    assert!(msg.contains("Bin status must be between 0 and 10"));
                    assert!(msg.contains("-1"));
                }
                _ => panic!("Expected ValidationError"),
            }

            match BinStatus::new(15) {
                Err(AppError::ValidationError(msg)) => {
                    assert!(msg.contains("Bin status must be between 0 and 10"));
                    assert!(msg.contains("15"));
                }
                _ => panic!("Expected InvalidRequest error"),
            }
        }

        #[test]
        fn test_bin_status_display_formatting() {
            assert_eq!(BinStatus::empty().to_string(), "Empty");
            assert_eq!(BinStatus::full().to_string(), "Full");
            assert_eq!(BinStatus::ok().to_string(), "50%");
            assert_eq!(BinStatus::new(1).unwrap().to_string(), "10%");
            assert_eq!(BinStatus::new(7).unwrap().to_string(), "70%");
            assert_eq!(BinStatus::new(9).unwrap().to_string(), "90%");
        }

        #[test]
        fn test_bin_status_convenience_methods() {
            let empty = BinStatus::empty();
            assert_eq!(empty.value(), 0);
            assert_eq!(empty.to_string(), "Empty");

            let ok = BinStatus::ok();
            assert_eq!(ok.value(), 5);
            assert_eq!(ok.to_string(), "50%");

            let full = BinStatus::full();
            assert_eq!(full.value(), 10);
            assert_eq!(full.to_string(), "Full");
        }

        #[test]
        fn test_bin_status_from_i32_clamping() {
            let status_negative = BinStatus::from(-5);
            assert_eq!(status_negative.value(), 0);

            let status_over_limit = BinStatus::from(15);
            assert_eq!(status_over_limit.value(), 10);

            let status_valid = BinStatus::from(7);
            assert_eq!(status_valid.value(), 7);
        }

        #[test]
        fn test_bin_status_clone_and_equality() {
            let status1 = BinStatus::new(5).unwrap();
            let status2 = status1.clone();
            assert_eq!(status1, status2);

            let status3 = BinStatus::new(7).unwrap();
            assert_ne!(status1, status3);
        }

        #[test]
        fn test_bin_status_serialization() {
            let status = BinStatus::new(7).unwrap();
            let json = serde_json::to_string(&status).unwrap();
            assert!(json.contains("\"value\":7"));

            let deserialized: BinStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(status, deserialized);
        }
    }

    mod request_response_tests {
        use super::*;

        #[test]
        fn test_status_update_request_serialization() {
            let bin_id = Uuid::new_v4();
            let request = StatusUpdateRequest {
                bin_id,
                status: BinStatus::new(5).unwrap(),
            };

            let json = serde_json::to_string(&request).unwrap();
            let deserialized: StatusUpdateRequest = serde_json::from_str(&json).unwrap();
            
            assert_eq!(request.bin_id, deserialized.bin_id);
            assert_eq!(request.status, deserialized.status);
        }

        #[test]
        fn test_status_update_response_serialization() {
            let response = StatusUpdateResponse {
                success: true,
                message: "Test message".to_string(),
                updated_at: Utc::now(),
            };

            let json = serde_json::to_string(&response).unwrap();
            let deserialized: StatusUpdateResponse = serde_json::from_str(&json).unwrap();
            
            assert_eq!(response.success, deserialized.success);
            assert_eq!(response.message, deserialized.message);
        }
    }
}
