use chrono::{DateTime, Utc};
use uuid::Uuid;

pub fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn current_timestamp() -> DateTime<Utc> {
    Utc::now()
}

pub fn format_timestamp(timestamp: &DateTime<Utc>) -> String {
    timestamp.to_rfc3339()
}

pub fn validate_bin_status(status: i32) -> bool {
    (0..=100).contains(&status)
}

pub fn calculate_fill_level_category(status: i32) -> &'static str {
    match status {
        0..=25 => "low",
        26..=50 => "medium",
        51..=75 => "high",
        76..=100 => "full",
        _ => "invalid"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_bin_status() {
        assert!(validate_bin_status(0));
        assert!(validate_bin_status(50));
        assert!(validate_bin_status(100));
        assert!(!validate_bin_status(-1));
        assert!(!validate_bin_status(101));
    }

    #[test]
    fn test_calculate_fill_level_category() {
        assert_eq!(calculate_fill_level_category(0), "low");
        assert_eq!(calculate_fill_level_category(25), "low");
        assert_eq!(calculate_fill_level_category(50), "medium");
        assert_eq!(calculate_fill_level_category(75), "high");
        assert_eq!(calculate_fill_level_category(100), "full");
        assert_eq!(calculate_fill_level_category(101), "invalid");
    }
}
