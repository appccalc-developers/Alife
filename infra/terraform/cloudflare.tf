resource "cloudflare_r2_bucket" "images" {
  account_id = var.cloudflare_account_id
  name       = var.r2_bucket_name
  location   = var.r2_bucket_location
}

resource "cloudflare_workers_kv_namespace" "authz" {
  account_id = var.cloudflare_account_id
  title      = var.authz_kv_namespace_title
}

resource "cloudflare_workers_kv_namespace" "api_cache" {
  account_id = var.cloudflare_account_id
  title      = var.api_cache_kv_namespace_title
}

resource "cloudflare_workers_custom_domain" "app" {
  count      = var.manage_cloudflare_worker_custom_domains ? 1 : 0
  account_id = var.cloudflare_account_id
  zone_id    = var.cloudflare_zone_id
  hostname   = var.cloudflare_zone_name
  service    = var.cloudflare_app_worker_name
}

resource "cloudflare_workers_custom_domain" "images" {
  count      = var.manage_cloudflare_worker_custom_domains ? 1 : 0
  account_id = var.cloudflare_account_id
  zone_id    = var.cloudflare_zone_id
  hostname   = "images.${var.cloudflare_zone_name}"
  service    = var.cloudflare_images_worker_name
}

resource "cloudflare_dns_record" "api" {
  count   = var.manage_api_dns_record ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.api_dns_record_name
  type    = "CNAME"
  content = azurerm_linux_function_app.api.default_hostname
  ttl     = 1
  proxied = var.api_dns_proxied

  comment = "Alife Azure Functions API host managed by Terraform."
}
