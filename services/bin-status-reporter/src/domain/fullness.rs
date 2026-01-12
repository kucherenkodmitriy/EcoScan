//! Fullness calculation logic using weighted average of recent reports
//!
//! This module implements a weighted average algorithm for calculating bin fullness.
//! Recent reports are given higher weight than older reports, providing:
//! - Better reflection of current bin state
//! - Smoother transitions between status changes
//! - Resistance to outliers/erroneous readings

/// Configuration for the fullness calculator
pub const DEFAULT_WINDOW_SIZE: usize = 10;

/// Represents a single status report value (0-100)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReportValue(pub i32);

impl ReportValue {
    pub fn new(value: i32) -> Self {
        Self(value.clamp(0, 100))
    }

    pub fn value(&self) -> i32 {
        self.0
    }
}

/// Calculates the weighted average fullness from a list of recent reports.
///
/// Uses linear decay weights where:
/// - Most recent report (index 0) gets highest weight
/// - Weights decrease linearly: [n, n-1, n-2, ..., 1]
/// - Final result is the weighted average, rounded to nearest integer
///
/// For 10 reports, weight distribution:
/// - Newest:  ~18.2% (10/55)
/// - 5th:     ~10.9% (6/55)
/// - Oldest:  ~1.8%  (1/55)
///
/// # Arguments
/// * `reports` - Slice of report values, ordered from newest to oldest
///
/// # Returns
/// * The weighted average as an integer (0-100)
/// * Returns 0 if no reports provided
///
/// # Examples
/// ```
/// use bin_status_reporter::domain::fullness::{calculate_weighted_average, ReportValue};
///
/// let reports = vec![
///     ReportValue::new(80),  // newest - weight 3
///     ReportValue::new(70),  // weight 2
///     ReportValue::new(60),  // oldest - weight 1
/// ];
/// let avg = calculate_weighted_average(&reports);
/// // (80*3 + 70*2 + 60*1) / 6 = (240 + 140 + 60) / 6 = 440/6 ≈ 73
/// assert_eq!(avg, 73);
/// ```
pub fn calculate_weighted_average(reports: &[ReportValue]) -> i32 {
    if reports.is_empty() {
        return 0;
    }

    let n = reports.len();

    // Calculate weights: newest gets weight n, oldest gets weight 1
    let (weighted_sum, total_weight) =
        reports
            .iter()
            .enumerate()
            .fold((0i64, 0i64), |(sum, weight_acc), (idx, report)| {
                let weight = (n - idx) as i64; // n for newest, 1 for oldest
                (sum + (report.value() as i64 * weight), weight_acc + weight)
            });

    // Round to nearest integer
    ((weighted_sum as f64 / total_weight as f64).round()) as i32
}

/// Calculates fullness using only the most recent N reports.
///
/// This is the main entry point for fullness calculation.
/// If fewer than `window_size` reports exist, uses all available reports.
///
/// # Arguments
/// * `reports` - All available reports, ordered from newest to oldest
/// * `window_size` - Maximum number of reports to consider (default: 10)
///
/// # Returns
/// * The weighted average fullness (0-100)
pub fn calculate_fullness(reports: &[ReportValue], window_size: usize) -> i32 {
    let window = if reports.len() > window_size {
        &reports[..window_size]
    } else {
        reports
    };

    calculate_weighted_average(window)
}

/// Convenience function using default window size (10)
pub fn calculate_fullness_default(reports: &[ReportValue]) -> i32 {
    calculate_fullness(reports, DEFAULT_WINDOW_SIZE)
}

#[cfg(test)]
mod tests {
    use super::*;

    mod calculate_weighted_average_tests {
        use super::*;

        #[test]
        fn test_empty_reports_returns_zero() {
            let reports: Vec<ReportValue> = vec![];
            assert_eq!(calculate_weighted_average(&reports), 0);
        }

        #[test]
        fn test_single_report_returns_that_value() {
            let reports = vec![ReportValue::new(75)];
            assert_eq!(calculate_weighted_average(&reports), 75);
        }

        #[test]
        fn test_two_reports_weighted_correctly() {
            // Newest: 80 (weight 2), Oldest: 40 (weight 1)
            // (80*2 + 40*1) / 3 = 200/3 ≈ 67
            let reports = vec![ReportValue::new(80), ReportValue::new(40)];
            assert_eq!(calculate_weighted_average(&reports), 67);
        }

        #[test]
        fn test_three_reports_weighted_correctly() {
            // Newest: 80 (weight 3), Middle: 70 (weight 2), Oldest: 60 (weight 1)
            // (80*3 + 70*2 + 60*1) / 6 = (240 + 140 + 60) / 6 = 440/6 ≈ 73
            let reports = vec![
                ReportValue::new(80),
                ReportValue::new(70),
                ReportValue::new(60),
            ];
            assert_eq!(calculate_weighted_average(&reports), 73);
        }

        #[test]
        fn test_newest_report_has_most_influence() {
            // If newest is high and rest are low, result should be closer to high
            let reports = vec![
                ReportValue::new(100), // weight 5
                ReportValue::new(0),   // weight 4
                ReportValue::new(0),   // weight 3
                ReportValue::new(0),   // weight 2
                ReportValue::new(0),   // weight 1
            ];
            // (100*5 + 0) / 15 = 500/15 ≈ 33
            assert_eq!(calculate_weighted_average(&reports), 33);
        }

        #[test]
        fn test_oldest_report_has_least_influence() {
            // If oldest is high and rest are low, result should still be low
            let reports = vec![
                ReportValue::new(0),   // weight 5
                ReportValue::new(0),   // weight 4
                ReportValue::new(0),   // weight 3
                ReportValue::new(0),   // weight 2
                ReportValue::new(100), // weight 1
            ];
            // (0 + 100*1) / 15 = 100/15 ≈ 7
            assert_eq!(calculate_weighted_average(&reports), 7);
        }

        #[test]
        fn test_uniform_values_return_that_value() {
            let reports = vec![
                ReportValue::new(50),
                ReportValue::new(50),
                ReportValue::new(50),
                ReportValue::new(50),
            ];
            assert_eq!(calculate_weighted_average(&reports), 50);
        }

        #[test]
        fn test_ten_reports_full_window() {
            // Simulate 10 reports with varying values
            let reports: Vec<ReportValue> = (0..10)
                .map(|i| ReportValue::new((100 - i * 10) as i32)) // 100, 90, 80, 70, 60, 50, 40, 30, 20, 10
                .collect();

            // Weights: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 (sum = 55)
            // Weighted sum: 100*10 + 90*9 + 80*8 + 70*7 + 60*6 + 50*5 + 40*4 + 30*3 + 20*2 + 10*1
            //             = 1000 + 810 + 640 + 490 + 360 + 250 + 160 + 90 + 40 + 10 = 3850
            // Average: 3850/55 = 70
            assert_eq!(calculate_weighted_average(&reports), 70);
        }

        #[test]
        fn test_boundary_values() {
            let reports = vec![ReportValue::new(0), ReportValue::new(100)];
            // (0*2 + 100*1) / 3 = 100/3 ≈ 33
            assert_eq!(calculate_weighted_average(&reports), 33);

            let reports = vec![ReportValue::new(100), ReportValue::new(0)];
            // (100*2 + 0*1) / 3 = 200/3 ≈ 67
            assert_eq!(calculate_weighted_average(&reports), 67);
        }

        #[test]
        fn test_rounding_behavior() {
            // Test that rounding works correctly for .5 cases
            let reports = vec![ReportValue::new(50), ReportValue::new(49)];
            // (50*2 + 49*1) / 3 = 149/3 = 49.67 → rounds to 50
            assert_eq!(calculate_weighted_average(&reports), 50);
        }
    }

    mod calculate_fullness_tests {
        use super::*;

        #[test]
        fn test_respects_window_size() {
            // 15 reports, but window is 10
            let reports: Vec<ReportValue> =
                (0..15).map(|i| ReportValue::new((i * 5) as i32)).collect();

            let with_window = calculate_fullness(&reports, 10);
            let without_window = calculate_weighted_average(&reports);

            // Should be different because window limits reports
            assert_ne!(with_window, without_window);
        }

        #[test]
        fn test_fewer_reports_than_window() {
            let reports = vec![ReportValue::new(80), ReportValue::new(60)];

            // Should use all available reports
            let result = calculate_fullness(&reports, 10);
            assert_eq!(result, calculate_weighted_average(&reports));
        }

        #[test]
        fn test_default_window_size() {
            let reports: Vec<ReportValue> = (0..15).map(|_| ReportValue::new(50)).collect();

            assert_eq!(
                calculate_fullness_default(&reports),
                calculate_fullness(&reports, DEFAULT_WINDOW_SIZE)
            );
        }
    }

    mod report_value_tests {
        use super::*;

        #[test]
        fn test_clamps_negative_values() {
            let report = ReportValue::new(-10);
            assert_eq!(report.value(), 0);
        }

        #[test]
        fn test_clamps_values_over_100() {
            let report = ReportValue::new(150);
            assert_eq!(report.value(), 100);
        }

        #[test]
        fn test_valid_values_unchanged() {
            assert_eq!(ReportValue::new(0).value(), 0);
            assert_eq!(ReportValue::new(50).value(), 50);
            assert_eq!(ReportValue::new(100).value(), 100);
        }
    }

    mod integration_tests {
        use super::*;

        #[test]
        fn test_realistic_scenario_bin_filling_up() {
            // Bin gradually filling up: oldest reports show empty, newest show nearly full
            let reports = vec![
                ReportValue::new(90), // newest
                ReportValue::new(80),
                ReportValue::new(70),
                ReportValue::new(55),
                ReportValue::new(40),
                ReportValue::new(30),
                ReportValue::new(20),
                ReportValue::new(15),
                ReportValue::new(10),
                ReportValue::new(5), // oldest
            ];

            let fullness = calculate_fullness_default(&reports);

            // Weighted average should favor recent high values
            // Should be higher than simple average (41.5) because recent reports are weighted more
            let simple_avg: i32 =
                reports.iter().map(|r| r.value()).sum::<i32>() / reports.len() as i32;
            assert!(
                fullness > simple_avg,
                "Weighted average ({}) should be > simple average ({})",
                fullness,
                simple_avg
            );
        }

        #[test]
        fn test_realistic_scenario_bin_emptied() {
            // Bin was emptied: oldest reports show full, newest show empty
            let reports = vec![
                ReportValue::new(5), // newest - just emptied
                ReportValue::new(10),
                ReportValue::new(25),
                ReportValue::new(50),
                ReportValue::new(70),
                ReportValue::new(85),
                ReportValue::new(90),
                ReportValue::new(95),
                ReportValue::new(98),
                ReportValue::new(100), // oldest - was full
            ];

            let fullness = calculate_fullness_default(&reports);

            // Should be lower than simple average because recent low values are weighted more
            let simple_avg: i32 =
                reports.iter().map(|r| r.value()).sum::<i32>() / reports.len() as i32;
            assert!(
                fullness < simple_avg,
                "Weighted average ({}) should be < simple average ({})",
                fullness,
                simple_avg
            );
        }

        #[test]
        fn test_outlier_resistance() {
            // Single outlier among consistent readings
            // Outlier at position 2 (second newest) has weight 4/15 ≈ 27%
            let reports = vec![
                ReportValue::new(50),  // newest - weight 5
                ReportValue::new(100), // outlier - weight 4
                ReportValue::new(50),  // weight 3
                ReportValue::new(50),  // weight 2
                ReportValue::new(50),  // oldest - weight 1
            ];

            let fullness = calculate_fullness_default(&reports);

            // Weighted: (50*5 + 100*4 + 50*3 + 50*2 + 50*1) / 15 = 950/15 ≈ 63
            // Simple average would be (50+100+50+50+50)/5 = 60
            // The outlier has more impact because it's the second-newest (high weight)
            // But if the outlier were older, the impact would be less
            assert_eq!(fullness, 63);

            // Test with outlier at oldest position - should have much less impact
            let reports_old_outlier = vec![
                ReportValue::new(50),  // newest - weight 5
                ReportValue::new(50),  // weight 4
                ReportValue::new(50),  // weight 3
                ReportValue::new(50),  // weight 2
                ReportValue::new(100), // outlier at oldest - weight 1
            ];

            let fullness_old_outlier = calculate_fullness_default(&reports_old_outlier);
            // Weighted: (50*5 + 50*4 + 50*3 + 50*2 + 100*1) / 15 = 800/15 ≈ 53
            assert_eq!(fullness_old_outlier, 53);

            // The newer outlier has more impact than the older one
            assert!(fullness > fullness_old_outlier);
        }
    }
}
