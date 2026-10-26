const RESET_SECRET = 'EVENT_RESET_DO_TOKEN'

export const createDeployConfig = (source, namespaceId, { requireEventResetSecret = true } = {}) => {
  const config = structuredClone(source)
  const requiredSecrets = Array.isArray(config.secrets?.required) ? config.secrets.required : []

  config.secrets = {
    ...(config.secrets ?? {}),
    required: requireEventResetSecret
      ? [...new Set([...requiredSecrets, RESET_SECRET])]
      : requiredSecrets.filter(secret => secret !== RESET_SECRET),
  }
  config.kv_namespaces = [
    {
      binding: 'API_CACHE',
      id: namespaceId,
    },
  ]

  return config
}
