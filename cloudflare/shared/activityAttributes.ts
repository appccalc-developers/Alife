export const activityAttributeCodes = ['hiking', 'water', 'sport', 'transport', 'camp', 'meal', 'outdoor'] as const
export const activityScopeCodes = ['generic', ...activityAttributeCodes] as const
export type ActivityWithAttributes = { attributes: string[] }
export const activityAttributes = (activity: ActivityWithAttributes): string[] => activity.attributes
export const validActivityScope = (value: unknown): value is string => typeof value === 'string' && (activityScopeCodes as readonly string[]).includes(value)
export const validActivityAttributes = (value: unknown): value is string[] => Array.isArray(value) && value.length <= activityAttributeCodes.length && value.every(code => typeof code === 'string' && (activityAttributeCodes as readonly string[]).includes(code)) && new Set(value).size === value.length
