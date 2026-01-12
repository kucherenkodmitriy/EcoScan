//! Error types for the bin-status-reporter service

use std::fmt;

/// Main error type for the application
#[derive(Debug)]
pub enum AppError {
    /// Error that occurs during repository operations
    RepositoryError(RepositoryError),
    /// Error that occurs during validation
    ValidationError(String),
    /// Error that occurs during serialization/deserialization
    SerializationError(serde_json::Error),
    /// Error for invalid requests
    InvalidRequest(String),
    /// Error for internal server errors
    InternalError(String),
}

impl std::error::Error for AppError {}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::RepositoryError(e) => write!(f, "Repository error: {}", e),
            AppError::ValidationError(e) => write!(f, "Validation error: {}", e),
            AppError::SerializationError(e) => write!(f, "Serialization error: {}", e),
            AppError::InvalidRequest(e) => write!(f, "Invalid request: {}", e),
            AppError::InternalError(e) => write!(f, "Internal error: {}", e),
        }
    }
}

impl From<RepositoryError> for AppError {
    fn from(err: RepositoryError) -> Self {
        AppError::RepositoryError(err)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::SerializationError(err)
    }
}

/// Errors that can occur during repository operations
#[derive(Debug)]
pub enum RepositoryError {
    /// Error when a requested resource is not found
    NotFound(String),
    /// Error that occurs during database operations
    DatabaseError(String),
    /// Error that occurs during data validation
    ValidationError(String),
}

impl std::error::Error for RepositoryError {}

impl fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RepositoryError::NotFound(msg) => write!(f, "Resource not found: {}", msg),
            RepositoryError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            RepositoryError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

/// A convenience type for Results that use our AppError
pub type Result<T> = std::result::Result<T, AppError>;
