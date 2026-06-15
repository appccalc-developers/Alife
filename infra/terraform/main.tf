data "azurerm_client_config" "current" {}

locals {
  common_tags = merge(
    {
      project     = var.project_name
      environment = var.environment
      managed_by  = "terraform"
    },
    var.tags,
  )

  sql_connection_string = join("", [
    "Server=tcp:", azurerm_mssql_server.main.fully_qualified_domain_name, ",1433;",
    "Initial Catalog=", azurerm_mssql_database.main.name, ";",
    "Persist Security Info=False;",
    "User ID=", var.sql_admin_login, ";",
    "Password=", var.sql_admin_password, ";",
    "MultipleActiveResultSets=False;",
    "Encrypt=True;",
    "TrustServerCertificate=False;",
    "Connection Timeout=30;",
  ])
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags
}

resource "azurerm_storage_account" "functions" {
  name                            = var.storage_account_name
  resource_group_name             = azurerm_resource_group.main.name
  location                        = azurerm_resource_group.main.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  allow_nested_items_to_be_public = false
  min_tls_version                 = "TLS1_2"
  tags                            = local.common_tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${var.project_name}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags
}

resource "azurerm_application_insights" "api" {
  name                = "appi-${var.project_name}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.common_tags
}

resource "azurerm_service_plan" "functions" {
  name                = "asp-${var.project_name}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = var.function_plan_sku_name
  tags                = local.common_tags
}

resource "azurerm_linux_function_app" "api" {
  name                       = var.function_app_name
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  service_plan_id            = azurerm_service_plan.functions.id
  storage_account_name       = azurerm_storage_account.functions.name
  storage_account_access_key = azurerm_storage_account.functions.primary_access_key
  functions_extension_version = "~4"
  https_only                 = true
  tags                       = local.common_tags

  site_config {
    always_on = var.function_plan_sku_name == "Y1" ? false : true

    application_stack {
      dotnet_version              = var.function_dotnet_version
      use_dotnet_isolated_runtime = true
    }

    application_insights_key               = azurerm_application_insights.api.instrumentation_key
    application_insights_connection_string = azurerm_application_insights.api.connection_string
  }

  app_settings = {
    ASPNETCORE_ENVIRONMENT               = var.environment == "prod" ? "Production" : var.environment
    FUNCTIONS_WORKER_RUNTIME             = "dotnet-isolated"
    WEBSITE_RUN_FROM_PACKAGE             = "1"
    Frontend__BaseUrl                    = var.frontend_base_url
    Cloudflare__AccountId                = var.cloudflare_account_id
    Cloudflare__AuthzNamespaceId         = cloudflare_workers_kv_namespace.authz.id
    Cloudflare__ApiCacheNamespaceId      = cloudflare_workers_kv_namespace.api_cache.id
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.api.connection_string
  }

  lifecycle {
    ignore_changes = [
      app_settings,
      sticky_settings,
    ]
  }
}

resource "azurerm_mssql_server" "main" {
  name                         = var.sql_server_name
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = var.sql_admin_login
  administrator_login_password = var.sql_admin_password
  minimum_tls_version          = "1.2"
  public_network_access_enabled = true
  tags                         = local.common_tags
}

resource "azurerm_mssql_database" "main" {
  name        = var.sql_database_name
  server_id   = azurerm_mssql_server.main.id
  sku_name    = var.sql_database_sku_name
  max_size_gb = 2
  tags        = local.common_tags
}

resource "azurerm_mssql_firewall_rule" "configured" {
  for_each = var.sql_firewall_rules

  name             = each.key
  server_id        = azurerm_mssql_server.main.id
  start_ip_address = each.value.start_ip_address
  end_ip_address   = each.value.end_ip_address
}

resource "azuread_application" "github_actions" {
  count        = var.create_github_oidc_identity ? 1 : 0
  display_name = "${var.project_name}-${var.environment}-github-actions"
}

resource "azuread_service_principal" "github_actions" {
  count     = var.create_github_oidc_identity ? 1 : 0
  client_id = azuread_application.github_actions[0].client_id
}

resource "azuread_application_federated_identity_credential" "github_main" {
  count          = var.create_github_oidc_identity ? 1 : 0
  application_id = azuread_application.github_actions[0].id
  display_name   = "github-${var.github_branch}"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"
}

resource "azurerm_role_assignment" "github_resource_group_contributor" {
  count                = var.create_github_oidc_identity ? 1 : 0
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.github_actions[0].object_id
}
