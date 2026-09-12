// Presentation fallback for unconfigured template roles. Saved candidate groups are authoritative.
export function defaultRosterModule(role: string): string {
  if (['welcome.team', 'checkin.team', 'registration.desk', 'front.of.house', 'registration.manager'].includes(role)) return 'PEOPLE.REGISTRATION'
  if (['setup.team', 'cleanup.team', 'site.team', 'resource.coordinator'].includes(role)) return 'PLACE.RESOURCE'
  if (['transport.coordinator', 'travel.coordinator'].includes(role)) return 'MOVE.STAY'
  if (role.startsWith('hospitality.')) return 'FOOD.HOSPITALITY'
  if (['programme.team', 'worship.team', 'av.operator', 'stage.team', 'event.host', 'programme.lead', 'production.lead'].includes(role)) return 'PROGRAM.PRODUCTION'
  if (role.startsWith('ram.')) return 'SAFETY.RAM'
  if (['safeguarding.lead', 'check-in.worker'].includes(role)) return 'SAFEGUARDING.CHILD'
  if (role === 'operations.commander') return 'FESTIVAL.OPERATIONS'
  if (role.startsWith('finance.')) return 'MONEY.FINANCE'
  if (role === 'comms.owner') return 'COMMS.FOLLOWUP'
  if (['event.lead', 'outing.lead', 'activity.lead', 'camp.director', 'retreat.lead', 'training.lead', 'facilitator.team', 'gathering.host', 'discussion.facilitator', 'service.lead', 'course.facilitator', 'prayer.lead', 'celebration.lead', 'outreach.lead'].includes(role)) return 'TEAM.WORK'
  return 'SERVICE.ROSTER'
}
