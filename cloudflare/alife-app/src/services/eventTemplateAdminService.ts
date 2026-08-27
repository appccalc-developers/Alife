import type {
  AdminEventActivityTemplate,
  AdminEventActivityTemplateCatalog,
  CreateAdminEventActivityTemplateRequest,
  EventTemplateAdminFilters,
  UpdateAdminEventActivityTemplateRequest,
} from '../types/eventTemplateAdmin'
import { http } from './http'

export const eventTemplateAdminService = {
  list: async (filters: EventTemplateAdminFilters = {}): Promise<AdminEventActivityTemplateCatalog> => {
    const { data } = await http.get<AdminEventActivityTemplateCatalog>('/api/admin/event-templates', {
      params: filters,
    })
    return data
  },

  create: async (request: CreateAdminEventActivityTemplateRequest): Promise<AdminEventActivityTemplate> => {
    const { data } = await http.post<AdminEventActivityTemplate>('/api/admin/event-templates', request)
    return data
  },

  update: async (
    code: string,
    request: UpdateAdminEventActivityTemplateRequest,
    eTag: string,
  ): Promise<AdminEventActivityTemplate> => {
    const { data } = await http.put<AdminEventActivityTemplate>(
      `/api/admin/event-templates/${encodeURIComponent(code)}`,
      request,
      { headers: { 'If-Match': eTag } },
    )
    return data
  },
}
