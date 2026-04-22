## Plan: New Azure Subscription Setup for Planner

Prepare a repeatable, low-risk pre-deployment setup for a new Azure subscription by standardizing identity, provisioning required Azure resources, wiring GitHub OIDC/secrets, and running gated smoke checks before first deployment. This plan keeps current architecture (Container Apps + App Service + Azure SQL + RabbitMQ) and avoids behavior changes.

**Steps**
1. Phase 1 - Confirm target naming and boundaries
2. Capture target environment naming conventions for resource group, region, ACR, Container Apps environment, container app names, App Service name, SQL server/database names, and tagging standards.
3. Confirm scope exclusions: AI worker remains outside this migration (DigitalOcean) and no Key Vault/App Configuration rollout in this pass.
4. Produce a parameter sheet consumed by setup scripts and CI secret mapping. This step blocks all provisioning steps.
5. Phase 2 - Identity and CI trust bootstrap
6. Create or reuse a dedicated Entra application/service principal for GitHub OIDC in the new subscription and assign least-privilege RBAC at resource-group scope.
7. Configure GitHub OIDC federated credentials for this repository and main branch workflow execution.
8. Validate OIDC login from GitHub Actions with a non-deploy workflow step. This step blocks deployment workflows.
9. Phase 3 - Provision Azure runtime resources
10. Provision resource group, Azure Container Registry, Container Apps environment, Azure SQL logical server/database, and App Service plan/web app for Blazor.
11. Provision runtime container apps for API and optimization worker with baseline ingress, revision, scaling, and registry binding.
12. Provision RabbitMQ runtime endpoint for cloud usage (container app or compatible managed replacement) and record host/port/user/password contract expected by app configuration.
13. Apply baseline observability and operational settings (diagnostic logs, retention, health probe endpoints, tags).
14. Phase 4 - Database readiness
15. Configure SQL firewall/network access required by DbMigrator workflow and runtime API access.
16. Run migration workflow against new SQL connection string and verify schema creation.
17. Run seed workflow only if demo data is desired in the target environment.
18. Phase 5 - CI/CD variable and secret cutover
19. Add or rotate GitHub repository/environment secrets for new subscription and new resources: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP, AZURE_CONTAINER_REGISTRY, AZURE_CONTAINERAPPS_ENVIRONMENT, AZURE_API_CONTAINER_APP_NAME, AZURE_CONTAINER_APP_NAME, AZURE_SQL_CONNECTION_STRING, PLANNERDB_CONNECTION, RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASS, AZUREAD_CLIENTID_API, SIGNALR_CLIENT, SIGNALR_ROUTE, JWT_ISSUER, JWT_AUDIENCE, JWT_SIGNING_KEY, JWT_SECRET, optional Firestore/Google keys.
20. Update hardcoded identity values in API deployment workflow to parameterized values so tenant/domain are not pinned to old defaults.
21. Add preflight validation steps in workflows to fail early when critical secrets are missing.
22. Phase 6 - Controlled first deployment
23. Trigger deployment order: db-migrator, API container app, worker container app, Blazor app.
24. Validate app startup and health endpoint responses, API auth handshake, worker queue consumption, and Blazor API connectivity.
25. Run rollback test by redeploying previous known image tag for API and worker.
26. Phase 7 - Script and runbook deliverables
27. Produce script set for bootstrap and repeatability: subscription bootstrap, resource provisioning, RBAC/OIDC setup, secret validation, and smoke test runner.
28. Produce an operator checklist aligned with scripts including required inputs, expected outputs, and failure recovery actions.

**Relevant files**
- c:/Projects/Planner/.github/workflows/deploy-planner-api-aca.yml - Primary API deployment contract, required secret surface, and hardcoded AzureAd domain/tenant values to parameterize.
- c:/Projects/Planner/.github/workflows/deploy-planner-optimization-worker-aca.yml - Worker deployment contract and secret dependencies for ACR + Container Apps + RabbitMQ.
- c:/Projects/Planner/.github/workflows/main_planner-blazor-dev.yml - Blazor App Service deployment target and OIDC login dependency.
- c:/Projects/Planner/.github/workflows/db-migrator-dev.yml - Database migration/seed orchestration and SQL connection secret.
- c:/Projects/Planner/src/Planner.API/Program.cs - Runtime required configuration keys for API startup validation.
- c:/Projects/Planner/src/Planner.BlazorApp/Program.cs - Required Api base URL and Entra OIDC configuration expectations.
- c:/Projects/Planner/src/Planner.Infrastructure/ServiceRegistration.cs - SQL provider and cache architecture baseline (no Redis dependency required for minimum setup).
- c:/Projects/Planner/src/Planner.Messaging/RabbitMQ/RabbitMqConnection.cs - RabbitMQ configuration key contract used by API and worker.
- c:/Projects/Planner/tools/Planner.Tools.DbMigrator/Program.cs - Migration/seed command behavior used in deployment readiness.

**Verification**
1. Identity verification: successful azure/login OIDC in GitHub Actions and az account show returns target subscription.
2. Infrastructure verification: az resource list filtered by target resource group includes ACR, Container Apps environment, API app, worker app, App Service, SQL server/database, and RabbitMQ runtime resource.
3. Secret verification: preflight script confirms all required GitHub secrets exist and are non-empty before deploy.
4. Database verification: migration workflow completes successfully; EF migration history table contains latest migration; API can open SQL connection at startup.
5. Runtime verification: API health endpoint responds healthy; worker logs show RabbitMQ connection and message consumption; Blazor can authenticate and call API.
6. Post-deploy verification: push a small change and confirm all four workflows deploy against new subscription resources without manual edits.

**Decisions**
- Included: Planner.API, Planner.Optimization.Worker, Planner.BlazorApp, DbMigrator/Azure SQL in new subscription.
- Excluded: Planner.AI worker migration from DigitalOcean in this pass.
- Constraint: same Entra tenant, different Azure subscription.
- Delivery format: both executable scripts and operator checklist.
- Guardrail: keep current architecture and deployment topology; no platform redesign during subscription move.

**Further Considerations**
1. RabbitMQ hosting choice for new subscription should be finalized early because it affects secret values and worker/API connectivity test design.
2. If production hardening is desired soon after migration, a follow-up phase can move secrets from GitHub to Key Vault references and remove plain env injection in container app updates.
3. If multi-environment expansion is planned, add environment-scoped GitHub secrets and workflow environment protection rules after initial cutover succeeds.