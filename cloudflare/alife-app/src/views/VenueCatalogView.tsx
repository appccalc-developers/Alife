import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronLeft, CirclePlus, MapPin, Save, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { groupService } from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { venueService } from '../services/venueService'
import { useAuthStore } from '../stores/auth'
import type { SaveVenuePayload, VenueDto } from '../types/venue'
import { localizeText } from '../utils/localizedText'

type VenueForm = Omit<SaveVenuePayload, 'churchGroupId'> & { id: string | null }

const emptySpace = () => ({
  id: null as string | null,
  nameEn: '',
  nameZh: '',
  capacity: 1,
  resourcesJson: '[]',
  bookingPolicyJson: '{}',
  isActive: true,
})

const emptyForm = (): VenueForm => ({
  id: null,
  nameEn: '',
  nameZh: '',
  descriptionEn: '',
  descriptionZh: '',
  addressEn: '',
  addressZh: '',
  timeZoneId: 'Pacific/Auckland',
  isActive: true,
  spaces: [emptySpace()],
})

const toForm = (venue: VenueDto): VenueForm => ({
  id: venue.id,
  nameEn: venue.name.en || '',
  nameZh: venue.name.zh || '',
  descriptionEn: venue.description.en || '',
  descriptionZh: venue.description.zh || '',
  addressEn: venue.address.en || '',
  addressZh: venue.address.zh || '',
  timeZoneId: venue.timeZoneId,
  isActive: venue.isActive,
  spaces: venue.spaces.map((space) => ({
    id: space.id,
    nameEn: space.name.en || '',
    nameZh: space.name.zh || '',
    capacity: space.capacity,
    resourcesJson: space.resourcesJson,
    bookingPolicyJson: space.bookingPolicyJson,
    isActive: space.isActive,
  })),
})

const inputClass = 'mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15'

const resourcesToText = (value: string) => {
  try {
    const resources = JSON.parse(value)
    return Array.isArray(resources) ? resources.filter((item): item is string => typeof item === 'string').join('、') : ''
  } catch { return '' }
}

const resourcesFromText = (value: string) => JSON.stringify(
  value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean),
)

const VenueCatalogView = () => {
  const { language } = useAuthStore()
  const isChinese = language === 'zh'
  const queryClient = useQueryClient()
  const [form, setForm] = useState<VenueForm>(emptyForm)
  const [message, setMessage] = useState('')
  const churchQuery = useQuery({ queryKey: ['church'], queryFn: groupService.getChurch, staleTime: 5 * 60_000 })
  const churchId = churchQuery.data?.id || ''
  const venuesQuery = useQuery({
    queryKey: ['managedVenues', churchId],
    queryFn: () => venueService.listManagedVenues(churchId),
    enabled: Boolean(churchId),
  })
  const saveMutation = useMutation({
    mutationFn: () => venueService.saveVenue(form.id, {
      churchGroupId: churchId,
      nameEn: form.nameEn,
      nameZh: form.nameZh,
      descriptionEn: form.descriptionEn,
      descriptionZh: form.descriptionZh,
      addressEn: form.addressEn,
      addressZh: form.addressZh,
      timeZoneId: form.timeZoneId,
      isActive: form.isActive,
      spaces: form.spaces,
    }),
    onSuccess: async (saved) => {
      setForm(toForm(saved))
      setMessage(isChinese ? '场地目录已保存。' : 'Venue catalog saved.')
      await queryClient.invalidateQueries({ queryKey: ['managedVenues', churchId] })
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })
  const activeCount = useMemo(() => venuesQuery.data?.filter((venue) => venue.isActive).length ?? 0, [venuesQuery.data])

  const updateSpace = (index: number, patch: Partial<VenueForm['spaces'][number]>) => {
    setForm((current) => ({ ...current, spaces: current.spaces.map((space, position) => position === index ? { ...space, ...patch } : space) }))
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin?church=dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-[#176b5a]"><ChevronLeft className="h-4 w-4" />{isChinese ? '返回教会管理' : 'Back to church management'}</Link>
        <Link to="/system/venue-bookings" className="rounded-xl border border-[#c9d8d2] bg-white px-4 py-2 text-sm font-bold text-[#176b5a] hover:bg-[#edf5f1]">{isChinese ? '处理场地申请' : 'Review venue requests'}</Link>
      </div>

      <section className="overflow-hidden rounded-[2rem] bg-[#173f36] p-6 text-white shadow-[0_22px_55px_rgba(23,63,54,0.18)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b9ddd1]">{isChinese ? '教会基础资料' : 'Church directory'}</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">{isChinese ? '场地目录维护' : 'Venue catalog'}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d7e8e2]">{isChinese ? '在这里登记教会实际拥有或可以使用的场地、空间、容量和设备。这里不创建活动，也不提交场地申请。' : 'Record the real venues and spaces the church can use, including capacity and equipment. Events and venue requests are not created here.'}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-3 text-center"><span className="block text-2xl font-black">{activeCount}</span><span className="text-xs text-[#d7e8e2]">{isChinese ? '个启用场地' : 'active venues'}</span></div>
        </div>
      </section>

      {message ? <div role="status" className="mt-5 rounded-xl border border-[#ddcdbd] bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-[#6f523f]">{message}</div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-[1.75rem] border border-[#ded6cb] bg-white p-4 shadow-sm">
          <button type="button" onClick={() => { setForm(emptyForm()); setMessage('') }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b5a] px-4 py-3 text-sm font-black text-white"><CirclePlus className="h-4 w-4" />{isChinese ? '登记新场地' : 'Add venue'}</button>
          <div className="mt-4 space-y-2">
            {venuesQuery.isLoading ? <p className="px-2 py-4 text-sm text-[#718079]">{isChinese ? '正在读取场地目录…' : 'Loading venues…'}</p> : null}
            {venuesQuery.error ? <p className="px-2 py-4 text-sm text-red-700">{normalizeApiError(venuesQuery.error).message}</p> : null}
            {!venuesQuery.isLoading && !venuesQuery.data?.length ? <p className="rounded-xl bg-[#f4f1ea] px-3 py-4 text-sm leading-6 text-[#718079]">{isChinese ? '目录目前为空。请按真实情况登记第一个场地，系统不会自动猜测。' : 'The catalog is empty. Add the first real venue; the system will not invent one.'}</p> : null}
            {venuesQuery.data?.map((venue) => (
              <button key={venue.id} type="button" onClick={() => { setForm(toForm(venue)); setMessage('') }} className={`w-full rounded-xl border px-3 py-3 text-left transition ${form.id === venue.id ? 'border-[#176b5a] bg-[#e9f3ef]' : 'border-[#e4ddd3] hover:bg-[#f7f4ee]'}`}>
                <span className="flex items-center gap-2 font-black text-[#18332d]"><Building2 className="h-4 w-4 text-[#176b5a]" />{localizeText(venue.name, language)}</span>
                <span className="mt-1 block text-xs text-[#718079]">{venue.spaces.length} {isChinese ? '个空间' : 'spaces'} · {venue.isActive ? (isChinese ? '已启用' : 'Active') : (isChinese ? '已停用' : 'Inactive')}</span>
              </button>
            ))}
          </div>
        </aside>

        <form onSubmit={(event) => { event.preventDefault(); setMessage(''); saveMutation.mutate() }} className="rounded-[1.75rem] border border-[#ded6cb] bg-[#fbfaf7] p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{form.id ? (isChinese ? '修改场地' : 'Edit venue') : (isChinese ? '新场地' : 'New venue')}</p><h2 className="mt-1 text-2xl font-black text-[#18332d]">{form.nameZh || form.nameEn || (isChinese ? '尚未命名' : 'Unnamed venue')}</h2></div>
            <label className="flex items-center gap-2 text-sm font-bold text-[#445b53]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />{isChinese ? '允许活动申请' : 'Available for requests'}</label>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-[#445b53]">中文名称<input className={inputClass} value={form.nameZh} onChange={(event) => setForm({ ...form, nameZh: event.target.value })} /></label>
            <label className="text-sm font-bold text-[#445b53]">English name<input className={inputClass} value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} /></label>
            <label className="text-sm font-bold text-[#445b53] sm:col-span-2"><span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{isChinese ? '地址（中文）' : 'Address (Chinese)'}</span><input className={inputClass} value={form.addressZh} onChange={(event) => setForm({ ...form, addressZh: event.target.value })} /></label>
            <label className="text-sm font-bold text-[#445b53] sm:col-span-2">{isChinese ? '地址（英文）' : 'Address (English)'}<input className={inputClass} value={form.addressEn} onChange={(event) => setForm({ ...form, addressEn: event.target.value })} /></label>
            <label className="text-sm font-bold text-[#445b53]">{isChinese ? '说明（中文）' : 'Description (Chinese)'}<textarea className={inputClass} rows={3} value={form.descriptionZh} onChange={(event) => setForm({ ...form, descriptionZh: event.target.value })} /></label>
            <label className="text-sm font-bold text-[#445b53]">{isChinese ? '说明（英文）' : 'Description (English)'}<textarea className={inputClass} rows={3} value={form.descriptionEn} onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })} /></label>
            <label className="text-sm font-bold text-[#445b53]">{isChinese ? '所在时区' : 'Time zone'}<input className={inputClass} required value={form.timeZoneId} onChange={(event) => setForm({ ...form, timeZoneId: event.target.value })} /></label>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3dcd2] pt-6"><div><h3 className="text-lg font-black text-[#18332d]">{isChinese ? '场地内的空间' : 'Spaces in this venue'}</h3><p className="mt-1 text-sm text-[#718079]">{isChinese ? '例如礼堂、课室或厨房；只填写真实存在的空间。' : 'For example a hall, classroom, or kitchen. Add only real spaces.'}</p></div><button type="button" onClick={() => setForm({ ...form, spaces: [...form.spaces, emptySpace()] })} className="inline-flex items-center gap-2 rounded-xl border border-[#bdd2ca] bg-white px-3 py-2 text-sm font-black text-[#176b5a]"><CirclePlus className="h-4 w-4" />{isChinese ? '添加空间' : 'Add space'}</button></div>
          <div className="mt-4 space-y-4">
            {form.spaces.map((space, index) => (
              <section key={space.id || `new-${index}`} className="rounded-2xl border border-[#ddd6cc] bg-white p-4">
                <div className="flex items-center justify-between gap-3"><strong className="text-sm text-[#18332d]">{isChinese ? `空间 ${index + 1}` : `Space ${index + 1}`}</strong><div className="flex items-center gap-3"><label className="text-xs font-bold text-[#60716a]"><input className="mr-1" type="checkbox" checked={space.isActive} onChange={(event) => updateSpace(index, { isActive: event.target.checked })} />{isChinese ? '启用' : 'Active'}</label>{form.spaces.length > 1 && !space.id ? <button type="button" aria-label={isChinese ? '移除空间' : 'Remove space'} onClick={() => setForm({ ...form, spaces: form.spaces.filter((_, position) => position !== index) })} className="text-[#a24c40]"><Trash2 className="h-4 w-4" /></button> : null}</div></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-bold text-[#445b53]">中文名称<input className={inputClass} value={space.nameZh} onChange={(event) => updateSpace(index, { nameZh: event.target.value })} /></label>
                  <label className="text-xs font-bold text-[#445b53]">English name<input className={inputClass} value={space.nameEn} onChange={(event) => updateSpace(index, { nameEn: event.target.value })} /></label>
                  <label className="text-xs font-bold text-[#445b53]">{isChinese ? '最多人数' : 'Capacity'}<input className={inputClass} type="number" min={1} value={space.capacity} onChange={(event) => updateSpace(index, { capacity: Number(event.target.value) })} /></label>
                  <label className="text-xs font-bold text-[#445b53] sm:col-span-3">{isChinese ? '可用设备（用逗号分开）' : 'Available equipment (separate with commas)'}<input className={inputClass} value={resourcesToText(space.resourcesJson)} onChange={(event) => updateSpace(index, { resourcesJson: resourcesFromText(event.target.value) })} placeholder={isChinese ? '例如：投影机、厨房、无障碍入口' : 'For example: projector, kitchen, accessible entrance'} /></label>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-7 flex justify-end"><button type="submit" disabled={saveMutation.isPending || !churchId} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5a] px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50"><Save className="h-4 w-4" />{saveMutation.isPending ? (isChinese ? '正在保存…' : 'Saving…') : (isChinese ? '保存场地目录' : 'Save venue')}</button></div>
        </form>
      </div>
    </main>
  )
}

export default VenueCatalogView
