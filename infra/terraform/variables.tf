variable "project_name" {
  description = "Short project identifier used in resource names and tags."
  type        = string
  default     = "alife"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region for long-lived infrastructure."
  type        = string
  default     = "australiaeast"
}

variable "resource_group_name" {
  description = "Azure resource group used by the existing backend deploy workflow."
  type        = string
  default     = "ccalc"
}

variable "function_app_name" {
  description = "Azure Function App name used by .github/workflows/main_ccalc-api.yml."
  type        = string
  default     = "fapi-ccalc"
}

variable "storage_account_name" {
  description = "Globally unique storage account name for the Azure Function App."
  type        = string
}

variable "function_plan_sku_name" {
  description = "Azure Functions hosting plan SKU. Y1 is Linux consumption."
  type        = string
  default     = "Y1"
}

variable "function_dotnet_version" {
  description = "Azure Functions .NET isolated runtime version."
  type        = string
  default     = "10.0"
}

variable "frontend_base_url" {
  description = "Public frontend base URL used for redirects and CORS."
  type        = string
  default     = "https://ccalc.live"
}

variable "passkey_rp_id" {
  description = "WebAuthn relying-party domain. It must equal the frontend host or be its registrable domain suffix."
  type        = string
  default     = "ccalc.live"
}

variable "api_hostname" {
  description = "Public API hostname used by the Cloudflare speed-layer API_PROXY_TARGET."
  type        = string
  default     = "api.ccalc.live"
}

variable "sql_server_name" {
  description = "Globally unique Azure SQL logical server name."
  type        = string
}

variable "sql_database_name" {
  description = "Azure SQL database name for Alife."
  type        = string
  default     = "alife"
}

variable "sql_database_sku_name" {
  description = "Azure SQL database SKU for alpha production."
  type        = string
  default     = "Basic"
}

variable "sql_admin_login" {
  description = "Azure SQL administrator login."
  type        = string
  sensitive   = true
}

variable "sql_admin_password" {
  description = "Azure SQL administrator password."
  type        = string
  sensitive   = true
}

variable "sql_firewall_rules" {
  description = "Long-lived Azure SQL firewall rules. GitHub runner rules remain in the deploy workflow."
  type = map(object({
    start_ip_address = string
    end_ip_address   = string
  }))
  default = {}
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID used by Wrangler and the backend cache refresh integration."
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for Terraform. Prefer TF_VAR_cloudflare_api_token or CLOUDFLARE_API_TOKEN in CI."
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for ccalc.live."
  type        = string
}

variable "cloudflare_zone_name" {
  description = "Cloudflare zone name."
  type        = string
  default     = "ccalc.live"
}

variable "cloudflare_app_worker_name" {
  description = "Cloudflare Worker name from cloudflare/speed-layer/wrangler.jsonc."
  type        = string
  default     = "app-ccalc"
}

variable "cloudflare_images_worker_name" {
  description = "Cloudflare Worker name from cloudflare/images-api/wrangler.toml."
  type        = string
  default     = "alife-cloudflare-api"
}

variable "r2_bucket_name" {
  description = "R2 bucket used by cloudflare/images-api/wrangler.toml."
  type        = string
  default     = "ccalc"
}

variable "r2_bucket_location" {
  description = "Optional R2 location hint. Leave null when importing an existing bucket if unsure."
  type        = string
  default     = null
}

variable "authz_kv_namespace_title" {
  description = "KV namespace title for backend-authored authorization mirror records."
  type        = string
  default     = "alife-authz-cache"
}

variable "api_cache_kv_namespace_title" {
  description = "KV namespace title for backend-authored API cache invalidation records."
  type        = string
  default     = "alife-api-cache"
}

variable "manage_cloudflare_worker_custom_domains" {
  description = "Set true only after removing custom_domain route management from Wrangler configs."
  type        = bool
  default     = false
}

variable "manage_api_dns_record" {
  description = "Set true to create api.<zone> DNS pointing at the Azure Function default hostname."
  type        = bool
  default     = false
}

variable "api_dns_record_name" {
  description = "Cloudflare DNS record name for the API host when manage_api_dns_record is true."
  type        = string
  default     = "api"
}

variable "api_dns_proxied" {
  description = "Whether Cloudflare should proxy the API CNAME record."
  type        = bool
  default     = true
}

variable "create_github_oidc_identity" {
  description = "Create an Azure AD app/service principal and federated credential for GitHub Actions."
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "GitHub repository in owner/name form for OIDC, for example StephenWu/Alife."
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "GitHub branch allowed to deploy through OIDC."
  type        = string
  default     = "main"
}

variable "tags" {
  description = "Additional Azure tags."
  type        = map(string)
  default     = {}
}
