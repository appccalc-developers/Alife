import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, UserCog, X } from 'lucide-react'
import type { AdminPlatformRoleDto } from '../../services/groupService'
import { Empty, LabeledField, SearchInput, TextInput } from './AdminUi'
import type { LabelFn } from './AdminUi'
import { formatRole, readLocalized } from './adminUtils'

export const RolesSection = ({ l, roles, roleForm, setRoleForm, creatingRole, deletingRoleId, updatingRolePermissionId, roleCodeValidation, roleCodeFeedback, canSubmitCreateRole, createRole, deleteRole, updateRolePermissions, language }: {
  l: LabelFn
  roles: AdminPlatformRoleDto[]
  roleForm: { code: string; nameEn: string; nameZh: string; permissionCodes: string[] }
  setRoleForm: React.Dispatch<React.SetStateAction<{ code: string; nameEn: string; nameZh: string; permissionCodes: string[] }>>
  creatingRole: boolean
  deletingRoleId: number | null
  language: string
  updatingRolePermissionId: number | null
  roleCodeValidation: string
  roleCodeFeedback: string
  canSubmitCreateRole: boolean
  createRole: () => Promise<boolean>
  deleteRole: (role: AdminPlatformRoleDto) => Promise<void>
  updateRolePermissions: (role: AdminPlatformRoleDto, permissionCode: string, enabled: boolean) => Promise<void>
}) => {
  const availablePermissions = roles.find((role) => role.availablePermissions.length)?.availablePermissions ?? []
  const manageableRoles = roles.filter((role) => role.code !== 'superadmin')
  const customRoleCount = manageableRoles.filter((role) => !role.isSystem).length
  const [roleSearch, setRoleSearch] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [selectedRoleCode, setSelectedRoleCode] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const visibleRoles = useMemo(() => {
    const term = roleSearch.trim().toLowerCase()
    if (!term) return manageableRoles
    return manageableRoles.filter((role) => {
      const name = readLocalized(role.name, language).toLowerCase()
      return role.code.toLowerCase().includes(term) || name.includes(term)
    })
  }, [language, manageableRoles, roleSearch])

  const filteredPermissions = useMemo(() => {
    const term = permissionSearch.trim().toLowerCase()
    if (!term) return availablePermissions
    return availablePermissions.filter((permission) => {
      const name = readLocalized(permission.name, language).toLowerCase()
      return permission.code.toLowerCase().includes(term) || name.includes(term)
    })
  }, [availablePermissions, language, permissionSearch])

  const selectedRole = manageableRoles.find((role) => role.code === selectedRoleCode) ?? manageableRoles[0] ?? null
  const selectedRoleSaving = selectedRole ? updatingRolePermissionId === selectedRole.id : false

  useEffect(() => {
    if (!selectedRole && manageableRoles.length) {
      setSelectedRoleCode(manageableRoles[0].code)
    }
  }, [manageableRoles, selectedRole])

  if (!availablePermissions.length) return null

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <UserCog className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">{l('rolePermissions')}</h2>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-600">{l('roleListDescription')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">{l('managedRoleCount')}: {manageableRoles.length}</span>
            <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">{l('customRole')}: {customRoleCount}</span>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {l('addRole')}
            </button>
          </div>
        </div>
        <p className="px-5 py-3 text-xs font-semibold leading-5 text-slate-500">{l('superAdminHidden')}</p>
        <p className="border-t border-slate-100 px-5 py-3 text-xs font-semibold leading-5 text-sky-700">{l('permissionModelHint')}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-black text-slate-950">{l('roleList')}</h2>
            <div className="mt-3">
              <SearchInput placeholder={l('search')} value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-3">
            {visibleRoles.length ? (
              <div className="grid gap-2">
                {visibleRoles.map((role) => {
                  const selected = selectedRole?.code === role.code
                  return (
                    <button
                      key={role.code}
                      type="button"
                      className={`flex min-h-16 w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${selected ? 'border-sky-200 bg-sky-50 text-slate-950 shadow-sm' : 'border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50'}`}
                      onClick={() => setSelectedRoleCode(role.code)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{readLocalized(role.name, language) || formatRole(role.code)}</span>
                        <span className="mt-1 block truncate font-mono text-[11px] font-semibold text-slate-400">{role.code}</span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${role.isSystem ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{role.isSystem ? l('builtInRole') : l('customRole')}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{l('assignedMembers')}: {role.assignedMemberCount}</span>
                        </span>
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black ${selected ? 'bg-white text-sky-800' : 'bg-slate-100 text-slate-500'}`}>{role.permissions.length}</span>
                    </button>
                  )
                })}
              </div>
            ) : <Empty text={l('noRolesMatch')} />}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-slate-400">{l('selectedRole')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-950">{selectedRole ? readLocalized(selectedRole.name, language) || formatRole(selectedRole.code) : l('rolePermissions')}</h2>
                {selectedRole ? <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500">{selectedRole.isSystem ? l('builtInRole') : l('customRole')}</span> : null}
              </div>
              <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-400">{selectedRole?.code || '-'}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {selectedRole ? <span className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">{l('enabledPermissions')}: {selectedRole.permissions.length}</span> : null}
              <div className="w-full sm:w-72">
                <SearchInput placeholder={l('search')} value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} />
              </div>
              {selectedRole ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={!selectedRole.canDelete || deletingRoleId === selectedRole.id}
                  onClick={() => deleteRole(selectedRole).catch(() => undefined)}
                >
                  {deletingRoleId === selectedRole.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                  {l('deleteRole')}
                </button>
              ) : null}
            </div>
          </div>
          {selectedRole ? (
            <div className="p-5">
              {filteredPermissions.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredPermissions.map((permission) => {
                    const checked = selectedRole.permissions.includes(permission.code)
                    const locked = !selectedRole.canEditPermissions
                    return (
                      <label key={permission.code} className={`flex min-h-[4.5rem] items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition ${checked ? 'border-sky-200 bg-sky-50/80 text-slate-950' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'} ${locked || selectedRoleSaving ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                        <span className="min-w-0">
                          <span className="block text-sm font-black">{readLocalized(permission.name, language) || permission.code}</span>
                          <span className="mt-1 block break-all font-mono text-[11px] font-semibold text-slate-400">{permission.code}</span>
                        </span>
                        <span className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${checked ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-slate-100'}`}>
                          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={locked || selectedRoleSaving}
                          onChange={(event) => updateRolePermissions(selectedRole, permission.code, event.target.checked).catch(() => undefined)}
                        />
                      </label>
                    )
                  })}
                </div>
              ) : <Empty text={l('rolePermissionsDescription')} />}
            </div>
          ) : <Empty text={l('noRolesMatch')} />}
        </section>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 px-3 py-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:justify-center">
          <button type="button" className="absolute inset-0" aria-label={l('closeDialog')} onClick={() => setCreateOpen(false)} />
          <section className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-black text-slate-950">{l('newRole')}</h2>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{l('rolesDescription')}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                aria-label={l('closeDialog')}
                onClick={() => setCreateOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <div className="grid items-start gap-4 md:grid-cols-3">
                <LabeledField label={l('roleCode')} hint={l('roleCodeHint')}>
                  <TextInput
                    className={`min-h-14 w-full ${roleCodeValidation ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-100'}`}
                    value={roleForm.code}
                    aria-invalid={Boolean(roleCodeValidation)}
                    onChange={(event) => setRoleForm((current) => ({ ...current, code: event.target.value.toLowerCase() }))}
                  />
                  <span className={`text-xs font-semibold leading-5 ${roleCodeValidation ? 'text-rose-600' : 'text-emerald-700'}`}>{roleCodeFeedback}</span>
                </LabeledField>
                <LabeledField label={l('roleNameEn')}>
                  <TextInput className="min-h-14 w-full" value={roleForm.nameEn} onChange={(event) => setRoleForm((current) => ({ ...current, nameEn: event.target.value }))} />
                </LabeledField>
                <LabeledField label={l('roleNameZh')}>
                  <TextInput className="min-h-14 w-full" value={roleForm.nameZh} onChange={(event) => setRoleForm((current) => ({ ...current, nameZh: event.target.value }))} />
                </LabeledField>
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-black text-slate-950">{l('initialPermissions')}</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {availablePermissions.map((permission) => {
                    const checked = roleForm.permissionCodes.includes(permission.code)
                    return (
                      <label key={permission.code} className={`flex min-h-12 items-start gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${checked ? 'border-sky-200 bg-sky-50 text-slate-900' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
                          checked={checked}
                          onChange={(event) => setRoleForm((current) => ({
                            ...current,
                            permissionCodes: event.target.checked
                              ? Array.from(new Set([...current.permissionCodes, permission.code]))
                              : current.permissionCodes.filter((code) => code !== permission.code),
                          }))}
                        />
                        <span>
                          <span className="block font-bold">{readLocalized(permission.name, language) || permission.code}</span>
                          <span className="mt-0.5 block break-all font-mono text-[11px] text-slate-400">{permission.code}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex sm:justify-end">
              <button type="button" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:w-36" onClick={() => setCreateOpen(false)}>
                {l('cancel')}
              </button>
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-36"
                type="button"
                disabled={!canSubmitCreateRole}
                onClick={async () => {
                  const ok = await createRole()
                  if (ok) setCreateOpen(false)
                }}
              >
                {creatingRole ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {l('createRole')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

    </div>
  )
}
