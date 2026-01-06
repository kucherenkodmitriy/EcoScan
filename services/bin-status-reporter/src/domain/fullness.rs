//! Fullness calculation logic for trash bins
//!
//! This module provides functions to calculate the fullness percentage of a trash bin
//! based on recent status reports. It uses a weighted average approach where more recent
//! reports have higher weight.

/// Default number of recent reports to consider when calculating fullness
pub const DEFAULT_WINDOW_SIZE: usize = 10;

/// Represents a single status report value
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReportValue {
    value: i32,
}

impl ReportValue {
    /// Creates a new ReportValue, clamping the value to 0-100 range
    pub fn new(value: i32) -> Self {
        Self {
            value: value.clamp(0, 100),
        }
    }

    /// Returns the underlying value
    pub fn value(&self) -> i32 {
        self.value
    }
}

impl From<i32> for ReportValue {
    fn from(value: i32) -> Self {
        Self::new(value)
    }
}

/// Calculates the fullness percentage using a weighted average of recent reports.
///
/// The weighting scheme gives more importance to recent reports:
/// - Most recent report: weight = n
/// - Second most recent: weight = n-1
/// - ...
/// - Oldest report: weight = 1
///
/// Where n is the number of reports.
///
/// # Arguments
/// * `reports` - Slice of recent reports, ordered from newest to oldest
///
/// # Returns
/// * Weighted average fullness percentage (0-100)
///
/// # Example
/// ```
/// use bin_status_reporter::domain::{ReportValue, calculate_fullness_default};
///
/// let reports = vec![
///     ReportValue::new(80), // Most recent
///     ReportValue::new(70),
///     ReportValue::new(60), // Oldest
/// ];
///
/// let fullness = calculate_fullness_default(&reports);
/// // Result will be weighted toward 80 (most recent)
/// assert!(fullness > 70);
/// ```
pub fn calculate_fullness(reports: &[ReportValue]) -> i32 {
    if reports.is_empty() {
        return 0;
    }

    let n = reports.len();
    let mut weighted_sum: i64 = 0;
    let mut weight_sum: i64 = 0;

    for (index, report) in reports.iter().enumerate() {
        // Weight decreases linearly from n to 1
        // index 0 (newest) gets weight n
        // index n-1 (oldest) gets weight 1
        let weight = (n - index) as i64;
        weighted_sum += (report.value() as i64) * weight;
        weight_sum += weight;
    }

    if weight_sum == 0 {
        return 0;
    }

    // Calculate weighted average and round to nearest integer
    ((weighted_sum as f64 / weight_sum as f64).round() as i32).clamp(0, 100)
}

/// Convenience function that calls calculate_fullness with default parameters
///
/// This is the primary function used by the repository layer.
pub fn calculate_fullness_default(reports: &[ReportValue]) -> i32 {
    calculate_fullness(reports)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_report_value_new() {
        let report = ReportValue::new(75);
        assert_eq!(report.value(), 75);
    }

    #[test]
    fn test_report_value_clamping() {
        let report_negative = ReportValue::new(-10);
        assert_eq!(report_negative.value(), 0);

        let report_over = ReportValue::new(150);
        assert_eq!(report_over.value(), 100);
    }

    #[test]
    fn test_report_value_from_i32() {
        let report: ReportValue = 50.into();
        assert_eq!(report.value(), 50);
    }

    #[test]
    fn test_calculate_fullness_empty() {
        let reports: Vec<ReportValue> = vec![];
        assert_eq!(calculate_fullness(&reports), 0);
    }

    #[test]
    fn test_calculate_fullness_single_report() {
        let reports = vec![ReportValue::new(75)];
        assert_eq!(calculate_fullness(&reports), 75);
    }

    #[test]
    fn test_calculate_fullness_uniform_values() {
        let reports = vec![
            ReportValue::new(50),
            ReportValue::new(50),
            ReportValue::new(50),
        ];
        assert_eq!(calculate_fullness(&reports), 50);
    }

    #[test]
    fn test_calculate_fullness_weighted_toward_recent() {
        // Most recent report is 80, older ones are lower
        let reports = vec![
            ReportValue::new(80), // weight 3
            ReportValue::new(60), // weight 2
            ReportValue::new(40), // weight 1
        ];
        // weighted_sum = 80*3 + 60*2 + 40*1 = 240 + 120 + 40 = 400
        // weight_sum = 3 + 2 + 1 = 6
        // average = 400/6 = 66.666... ≈ 67
        assert_eq!(calculate_fullness(&reports), 67);
    }

    #[test]
    fn test_calculate_fullness_increasing_trend() {
        // Bin is filling up over time
        let reports = vec![
            ReportValue::new(100), // Most recent
            ReportValue::new(90),
            ReportValue::new(80),
            ReportValue::new(70),
            ReportValue::new(60), // Oldest
        ];
        // Should be weighted toward 100
        let result = calculate_fullness(&reports);
        assert!(result > 80, "Expected > 80, got {}", result);
        assert!(result <= 100);
    }

    #[test]
    fn test_calculate_fullness_decreasing_trend() {
        // Bin was just emptied
        let reports = vec![
            ReportValue::new(10), // Most recent (just emptied)
            ReportValue::new(20),
            ReportValue::new(40),
            ReportValue::new(60),
            ReportValue::new(80), // Oldest (was full)
        ];
        // Should be weighted toward 10
        let result = calculate_fullness(&reports);
        assert!(result < 50, "Expected < 50, got {}", result);
        assert!(result >= 0);
    }

    #[test]
    fn test_calculate_fullness_default_matches_calculate() {
        let reports = vec![
            ReportValue::new(70),
            ReportValue::new(60),
            ReportValue::new(50),
        ];
        assert_eq!(
            calculate_fullness_default(&reports),
            calculate_fullness(&reports)
        );
    }

    #[test]
    fn test_calculate_fullness_many_reports() {
        // Test with DEFAULT_WINDOW_SIZE reports
        let reports: Vec<ReportValue> = (0..DEFAULT_WINDOW_SIZE)
            .map(|i| ReportValue::new(50 + i as i32))
            .collect();

        let result = calculate_fullness(&reports);
        assert!(result >= 50);
        assert!(result <= 100);
    }

    #[test]
    fn test_calculate_fullness_boundary_values() {
        // All empty
        let empty_reports = vec![
            ReportValue::new(0),
            ReportValue::new(0),
            ReportValue::new(0),
        ];
        assert_eq!(calculate_fullness(&empty_reports), 0);

        // All full
        let full_reports = vec![
            ReportValue::new(100),
            ReportValue::new(100),
            ReportValue::new(100),
        ];
        assert_eq!(calculate_fullness(&full_reports), 100);
    }

    #[test]
    fn test_default_window_size_constant() {
        assert_eq!(DEFAULT_WINDOW_SIZE, 10);
    }
}
