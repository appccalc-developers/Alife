# Alife Terraform

This Terraform configuration codifies the long-lived infrastructure implied by the current GitHub Actions workflows and Wrangler configs.

It intentionally does not deploy Worker code, static assets, Durable Object migrations, database migrations, or the Azure Functions package. Those stay in the existing deployment workflows:

- `.github/workflows/deploy-cloudflare-worker.yml`
- `.github/workflows/deploy-cloudflare-images-api.yml`
- `.github/workflows/main_ccalc-api.yml`

## What It Manages

- Azure resource group `ccalc`
- Azure Linux Function App `fapi-ccalc`
- Function storage, hosting plan, Application Insights, and Log Analytics
- Azure SQL server and database
- Optional long-lived Azure SQL firewall rules
- Optional GitHub Actions Azure OIDC service principal
- Cloudflare R2 bucket `ccalc`
- Cloudflare KV namespaces used by backend cache refresh settings
- Optional Cloudflare Worker custom domains, only if Wrangler stops managing them
- Optional `api.ccalc.live` DNS CNAME to the Azure Function default hostname

## Why Worker Deployments Stay In Wrangler

The current Worker deploys use Wrangler for:

- `cloudflare/speed-layer` static assets from `cloudflare/alife-app/dist`
- Durable Object bindings and migrations
- Worker secrets from `--secrets-file .dev.vars`
- `cloudflare/images-api` R2 bindings and OpenAPI upload

Managing those same Worker deployments in Terraform would conflict with Wrangler. Keep `manage_cloudflare_worker_custom_domains = false` unless you first remove the `custom_domain` route entries from the Wrangler configs and import or recreate the custom domains in Terraform.

## First Run

```powershell
cd infra/terraform
Copy-Item terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with real IDs and secrets.
terraform init
terraform plan
```

For existing Azure or Cloudflare resources, import them into state before applying. Do not apply over existing production resources until the plan shows only intentional changes.

## Workflow Secrets/Variables To Update From Outputs

After apply:

```powershell
terraform output
terraform output -raw db_connection_string
```

Use the outputs to populate the current GitHub workflow secrets:

- `AZURE_CLIENT_ID` from `azure_github_actions_client_id`, if Terraform created the OIDC identity
- `AZURE_TENANT_ID` from `azure_tenant_id`
- `AZURE_SUBSCRIPTION_ID` from `azure_subscription_id`
- `DB_CONNECTION_STRING` from `db_connection_string`
- `FRONTEND_BASE_URL` from `frontend_base_url`
- `CLOUDFLARE_ACCOUNT_ID` from `cloudflare_account_id`
- `CLOUDFLARE_AUTHZ_NAMESPACE_ID` from `cloudflare_authz_namespace_id`
- `CLOUDFLARE_API_CACHE_NAMESPACE_ID` from `cloudflare_api_cache_namespace_id`
- `API_PROXY_TARGET` from `api_proxy_target`

The following remain manually supplied secrets:

- `JWT_KEY`
- `LINE_LOGIN_CLIENT_ID`
- `LINE_LOGIN_CLIENT_SECRET`
- `LINE_LOGIN_REDIRECT_URI`
- `CLOUDFLARE_API_TOKEN`
- `GEMINI_API_KEY`

## Notes

- `terraform.tfvars`, local state, and `.terraform/` are ignored by `.gitignore`.
- Azure Function runtime settings are ignored after creation because the backend workflow already sets runtime secrets before deployment.
- The deploy workflow still opens a temporary SQL firewall rule for each GitHub runner and removes it after deployment.
