import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { groupService } from '../services/groupService'
import type { GroupDto, GroupSummaryDto } from '../types'

const GroupsView = () => {
  const [church, setChurch] = useState<GroupDto | null>(null)
  const [subgroups, setSubgroups] = useState<GroupSummaryDto[]>([])

  useEffect(() => {
    const load = async () => {
      const data = await groupService.getChurch()
      setChurch(data)
      setSubgroups(await groupService.getSubgroups(data.id))
    }

    load().catch(() => undefined)
  }, [])

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Groups</h1>
      {church ? (
        <article className="rounded-xl border bg-white p-4">
          <h2 className="text-xl font-semibold">{church.name}</h2>
          <Link className="text-blue-600" to={`/groups/${church.id}`}>
            Open church
          </Link>
        </article>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {subgroups.map((group) => (
          <article key={group.id} className="rounded-xl border bg-white p-4">
            <h3 className="font-semibold">{group.name}</h3>
            <p className="text-sm text-slate-600">{group.accessType}</p>
            <Link className="text-blue-600" to={`/groups/${group.id}`}>
              Details
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}

export default GroupsView
