FROM public.ecr.aws/lambda/provided:latest-arm64

# Copy the function code
COPY target/aarch64-unknown-linux-gnu/release/ecoscan-lambda ${LAMBDA_RUNTIME_DIR}/bootstrap

# Set the CMD to your handler (required but not used with custom runtime)
CMD ["ecoscan-lambda"]
