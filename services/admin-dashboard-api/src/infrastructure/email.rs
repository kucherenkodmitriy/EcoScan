use aws_sdk_sesv2::types::{Body as SesBody, Content, Destination, EmailContent, Message};
use aws_sdk_sesv2::Client as SesClient;
use tracing::{info, instrument};

use crate::domain::{AppError, Result};

pub struct EmailService {
    client: SesClient,
    from_email: String,
}

impl EmailService {
    pub async fn new(from_email: String, dynamodb_endpoint: Option<&str>) -> Result<Self> {
        let sdk_config = if let Some(endpoint) = dynamodb_endpoint {
            aws_config::defaults(aws_config::BehaviorVersion::latest())
                .endpoint_url(endpoint)
                .load()
                .await
        } else {
            aws_config::defaults(aws_config::BehaviorVersion::latest())
                .load()
                .await
        };

        let client = SesClient::new(&sdk_config);

        Ok(Self { client, from_email })
    }

    #[instrument(skip(self, reset_link))]
    pub async fn send_password_reset_email(&self, to_email: &str, reset_link: &str) -> Result<()> {
        let subject = "EcoScan - Password Reset Request".to_string();

        let body_text = format!(
            "You requested a password reset for your EcoScan account.\n\n\
             Click the link below to reset your password:\n\
             {}\n\n\
             This link expires in 1 hour.\n\n\
             If you did not request this, you can safely ignore this email.\n",
            reset_link
        );

        let body_html = format!(
            "<html><body>\
             <h2>Password Reset Request</h2>\
             <p>You requested a password reset for your EcoScan account.</p>\
             <p><a href=\"{link}\" style=\"display:inline-block;padding:12px 24px;\
             background:#2e7d32;color:#fff;text-decoration:none;border-radius:6px;\
             font-weight:600\">Reset Password</a></p>\
             <p>Or copy this link: <a href=\"{link}\">{link}</a></p>\
             <p>This link expires in 1 hour.</p>\
             <p style=\"color:#888\">If you did not request this, you can safely ignore this email.</p>\
             </body></html>",
            link = reset_link
        );

        let subject_content = Content::builder()
            .data(subject)
            .charset("UTF-8")
            .build()
            .map_err(|e| AppError::InternalError(format!("Failed to build subject: {}", e)))?;

        let text_content = Content::builder()
            .data(body_text)
            .charset("UTF-8")
            .build()
            .map_err(|e| AppError::InternalError(format!("Failed to build text body: {}", e)))?;

        let html_content = Content::builder()
            .data(body_html)
            .charset("UTF-8")
            .build()
            .map_err(|e| AppError::InternalError(format!("Failed to build HTML body: {}", e)))?;

        let email_content = EmailContent::builder()
            .simple(
                Message::builder()
                    .subject(subject_content)
                    .body(
                        SesBody::builder()
                            .text(text_content)
                            .html(html_content)
                            .build(),
                    )
                    .build(),
            )
            .build();

        self.client
            .send_email()
            .from_email_address(&self.from_email)
            .destination(Destination::builder().to_addresses(to_email).build())
            .content(email_content)
            .send()
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to send email: {}", e)))?;

        info!(to = %to_email, "Password reset email sent");
        Ok(())
    }

    #[instrument(skip(self, initial_password))]
    pub async fn send_welcome_email(
        &self,
        to_email: &str,
        name: &str,
        initial_password: &str,
    ) -> Result<()> {
        let subject = "Welcome to EcoScan - Your Account Details".to_string();

        let body_text = format!(
            "Welcome to EcoScan, {}!\n\n\
             Your admin account has been created successfully.\n\n\
             Email: {}\n\
             Initial Password: {}\n\n\
             For security reasons, we strongly recommend changing your password after your first login.\n\n\
             If you did not expect this email, please contact your administrator.\n",
            name, to_email, initial_password
        );

        let body_html = format!(
            "<html><body>\
             <h2>Welcome to EcoScan!</h2>\
             <p>Hi {},</p>\
             <p>Your admin account has been created successfully.</p>\
             <div style=\"background:#f5f5f5;padding:20px;border-radius:6px;margin:20px 0\">\
             <p><strong>Email:</strong> {}</p>\
             <p><strong>Initial Password:</strong> <code style=\"background:#fff;padding:4px 8px;border-radius:4px\">{}</code></p>\
             </div>\
             <p style=\"color:#d32f2f\"><strong>Important:</strong> For security reasons, we strongly recommend changing your password after your first login.</p>\
             <p style=\"color:#888\">If you did not expect this email, please contact your administrator.</p>\
             </body></html>",
            name, to_email, initial_password
        );

        let subject_content = Content::builder()
            .data(subject)
            .charset("UTF-8")
            .build()
            .map_err(|e| AppError::InternalError(format!("Failed to build subject: {}", e)))?;

        let text_content = Content::builder()
            .data(body_text)
            .charset("UTF-8")
            .build()
            .map_err(|e| AppError::InternalError(format!("Failed to build text body: {}", e)))?;

        let html_content = Content::builder()
            .data(body_html)
            .charset("UTF-8")
            .build()
            .map_err(|e| AppError::InternalError(format!("Failed to build HTML body: {}", e)))?;

        let email_content = EmailContent::builder()
            .simple(
                Message::builder()
                    .subject(subject_content)
                    .body(
                        SesBody::builder()
                            .text(text_content)
                            .html(html_content)
                            .build(),
                    )
                    .build(),
            )
            .build();

        self.client
            .send_email()
            .from_email_address(&self.from_email)
            .destination(Destination::builder().to_addresses(to_email).build())
            .content(email_content)
            .send()
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to send email: {}", e)))?;

        info!(to = %to_email, "Welcome email sent");
        Ok(())
    }

    pub fn is_configured(&self) -> bool {
        !self.from_email.is_empty()
    }
}
