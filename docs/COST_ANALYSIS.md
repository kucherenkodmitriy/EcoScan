# EcoScan Operational Cost Analysis

**Last Updated:** 2026-03-29

Cost estimates for a small pilot deployment (couple of streets, ~50 containers).
All prices are for **eu-central-1** region, post-12-month AWS free tier, with always-free tiers applied.

## Infrastructure Summary

| Resource | Configuration |
|----------|--------------|
| Lambda functions | 6 × (128–256 MB, x86_64) |
| DynamoDB tables | 7 × PAY_PER_REQUEST (on-demand) with PITR |
| API Gateway | REST API (not HTTP API) |
| SQS queues | 2 main + 2 DLQ |
| SNS topics | 1 (KMS-encrypted) |
| S3 buckets | 3 (health, lambda artifacts, frontend) |
| CloudFront | PriceClass_100 (NA + Europe) |
| Secrets Manager | 2 secrets (JWT + Google Maps key) |
| SES | Password reset + contact form emails |
| CloudWatch | 14-day log retention |
| VPC / NAT | None — fully serverless |

## AWS Cost Breakdown

| Service | Always-Free Tier | Scenario 1 | Scenario 2 | Scenario 3 |
|---------|-----------------|------------|------------|------------|
| | | **50 bins, 100 req/day** | **50 bins, 500 req/day** | **200 bins, 2K req/day** |
| Lambda | 1M req + 400K GB-s/mo | $0.00 | $0.00 | $0.00 |
| API Gateway (REST) | — | $0.01 | $0.05 | $0.21 |
| DynamoDB (on-demand) | — | $0.01 | $0.03 | $0.11 |
| DynamoDB PITR | — | ~$0.00 | ~$0.00 | $0.01 |
| SQS | 1M req/mo | $0.00 | $0.00 | $0.00 |
| SNS | 1M publishes/mo | $0.00 | $0.00 | $0.00 |
| CloudFront | — | $0.29 | $0.97 | $2.91 |
| S3 (3 buckets) | — | $0.01 | $0.02 | $0.03 |
| Secrets Manager | — | $0.80 | $0.80 | $0.80 |
| CloudWatch Logs | 5 GB ingest/mo | $0.05 | $0.15 | $0.53 |
| SES | — | $0.00 | $0.01 | $0.02 |
| KMS (SNS encryption) | — | $0.03 | $0.03 | $0.03 |
| **AWS Total** | | **~$1.20/mo** | **~$2.06/mo** | **~$4.65/mo** |

### Key Observations

- **Secrets Manager ($0.80/mo)** is the largest fixed cost — 67% of the bill in Scenario 1.
  Could be eliminated by using Lambda env vars with default KMS encryption (free), at the cost of reduced security.
- **Lambda, SQS, SNS** are effectively free at pilot scale thanks to always-free tiers that never expire.
- **CloudFront** dominates variable costs, scaling with page views rather than API calls.
- **REST API Gateway** is 3.5× more expensive than HTTP API ($3.50 vs $1.00 per million calls).
  Doesn't matter at pilot scale, but worth considering if traffic grows significantly.

## Google Maps API

Google provides a **$200/month free credit**. All pilot scenarios fit within it.

| API | Price per 1K calls | Scenario 1 | Scenario 2 | Scenario 3 |
|-----|-------------------|------------|------------|------------|
| Maps JavaScript (dashboard loads) | $7.00 | $0.70 | $2.10 | $7.00 |
| Directions (route planning) | $5.00 | $0.15 | $0.50 | $2.50 |
| Geocoding (address lookup) | $5.00 | $0.05 | $0.25 | $1.00 |
| Places Autocomplete | $2.83 | $0.14 | $0.28 | $1.42 |
| **Subtotal** | | $1.04 | $3.13 | $11.92 |
| **After $200 free credit** | | **$0.00** | **$0.00** | **$0.00** |

## GitHub Actions (CI/CD)

The pipeline has **16 jobs** on `ubuntu-latest`. Wall-clock time is 10–15 minutes, but billing is per-job.

### Billable Minutes per Full Run (~51 min)

| Job | Minutes | Trigger |
|-----|---------|---------|
| detect-changes | 0.5 | Always |
| security-scan | 4 | Rust or frontend changed |
| lint | 5 | Rust changed |
| test | 5 | Rust changed |
| build-lambda (Docker) | 7 | Rust changed |
| upload-lambda-s3 | 1 | Rust changed, dev branch |
| terraform-validate (5× matrix) | 5 | Infra changed |
| deploy-foundation | 2 | Foundation/tfvars changed |
| deploy-data | 2 | Data/tfvars changed |
| deploy-compute | 3 | Compute/tfvars/rust changed |
| deploy-api | 2 | API/tfvars changed |
| build-frontend | 3 | Frontend changed |
| deploy-frontend | 3 | Frontend/infra changed |
| smoke-tests | 3 | Rust or infra changed |
| e2e-tests-aws | 5 | After smoke tests pass |
| deployment-summary | 0.5 | Always (dev branch) |

A single Rust change triggers ~12 of 16 jobs (~45 billable minutes).

### GitHub Actions Cost

GitHub Free plan: **2,000 min/month** for private repos. Overage: **$0.008/min** (Linux).
Public repos have **unlimited free minutes**.

| Dev Intensity | Pushes/mo | Avg min/push | Monthly minutes | Cost |
|---------------|-----------|-------------|-----------------|------|
| Light | 10 | ~35 | 350 | $0.00 |
| Active | 30 | ~45 | 1,350 | $0.00 |
| Heavy | 50 | ~51 | 2,550 | $4.40 |
| Sprint | 80 | ~45 | 3,600 | $12.80 |

### Potential CI Optimizations

- **Merge terraform-validate matrix into a single job** — saves ~4 min/run (5 runners → 1)
- **Combine lint + test into one job** — saves ~4 min/run
- These two changes alone would drop a full run from ~51 to ~43 billable minutes

## Total Monthly Cost

| | Scenario 1 | Scenario 2 | Scenario 3 |
|---|---|---|---|
| | 50 bins, 100 req/day | 50 bins, 500 req/day | 200 bins, 2K req/day |
| | 10 pushes/mo | 30 pushes/mo | 50 pushes/mo |
| AWS | $1.20 | $2.06 | $4.65 |
| GitHub Actions | $0.00 | $0.00 | $4.40 |
| Google Maps | $0.00 | $0.00 | $0.00 |
| **Total** | **~$1.20/mo** | **~$2.06/mo** | **~$9.05/mo** |

## Notes

- Prices are approximate and based on AWS public pricing as of March 2026.
- DynamoDB on-demand pricing: $1.25/million WRUs, $0.25/million RRUs.
- CloudFront (Europe): $0.085/GB data transfer, $0.012/10K HTTPS requests.
- Always-free tiers (Lambda, SQS, SNS) never expire and cover pilot-scale usage entirely.
- A custom domain via Route 53 would add $0.50/month per hosted zone.