use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Bin not found: {0}")]
    BinNotFound(String),

    #[error("Internal server error: {0}")]
    InternalError(String),
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
} 
