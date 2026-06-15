output "azure_resource_group_name" {
  description = "Use as AZURE_RESOURCE_GROUP in the backend deployment workflow."
  value       = azurerm_resource_group.main.name
}

output "azure_function_app_name" {
  description = "Use as AZURE_FUNCTIONAPP_NAME in the backend deployment workflow."
  value       = azurerm_linux_function_app.api.name
}

output "azure_function_default_hostname" {
  description = "Default Azure Functions hostname before any custom domain binding."
  value       = azurerm_linux_function_app.api.default_hostname
}

output "azure_tenant_id" {
  description = "Use as AZURE_TENANT_ID for GitHub OIDC."
  value       = data.azurerm_client_config.current.tenant_id
}

output "azure_subscription_id" {
  description = "Use as AZURE_SUBSCRIPTION_ID for GitHub OIDC."
  value       = data.azurerm_client_config.current.subscription_id
}

output "azure_github_actions_client_id" {
  description = "Use as AZURE_CLIENT_ID when create_github_oidc_identity is true."
  value       = var.create_github_oidc_identity ? azuread_application.github_actions[0].client_id : null
}

output "db_connection_string" {
  description = "Use as DB_CONNECTION_STRING GitHub secret and Azure Function runtime setting."
  value       = local.sql_connection_string
  sensitive   = true
}

output "cloudflare_account_id" {
  description = "Use as CLOUDFLARE_ACCOUNT_ID in GitHub Actions."
  value       = var.cloudflare_account_id
}

output "cloudflare_authz_namespace_id" {
  description = "Use as CLOUDFLARE_AUTHZ_NAMESPACE_ID in the backend deployment workflow."
  value       = cloudflare_workers_kv_namespace.authz.id
}

output "cloudflare_api_cache_namespace_id" {
  description = "Use as CLOUDFLARE_API_CACHE_NAMESPACE_ID in the backend deployment workflow."
  value       = cloudflare_workers_kv_namespace.api_cache.id
}

output "cloudflare_r2_bucket_name" {
  description = "R2 bucket used by the images API Worker."
  value       = cloudflare_r2_bucket.images.name
}

output "frontend_base_url" {
  description = "Use as FRONTEND_BASE_URL in the backend deployment workflow."
  value       = var.frontend_base_url
}

output "api_proxy_target" {
  description = "Use as API_PROXY_TARGET in the Cloudflare speed-layer deployment workflow."
  value       = "https://${var.api_hostname}"
}
