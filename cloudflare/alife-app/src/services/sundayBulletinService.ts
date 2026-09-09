import { http } from './http'

export type SundayBulletinList = { canManage: boolean; items: { date: string; hasFile: boolean }[] }
export const sundayBulletinEndpoint = '/api/church-life/bulletins'

export const sundayBulletinService = {
  async list(dates: string[]) {
    const results: SundayBulletinList[] = []
    for (let offset = 0; offset < dates.length; offset += 100) {
      const params = new URLSearchParams()
      dates.slice(offset, offset + 100).forEach(date => params.append('dates', date))
      results.push((await http.get<SundayBulletinList>(`${sundayBulletinEndpoint}?${params}`)).data)
    }
    return { canManage: results.length > 0 && results.every(result => result.canManage), items: results.flatMap(result => result.items) }
  },
  async upload(date: string, file: File) {
    const data = new FormData()
    data.append('file', file)
    await http.put(`${sundayBulletinEndpoint}/${date}`, data)
  },
}
