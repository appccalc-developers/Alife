import assert from 'node:assert/strict'
import test from 'node:test'
import { getGroupSiteMenu, getGroupSiteRoute, getLegacyGroupEntryPath } from '../src/app/navigation/groupSiteNavigation.ts'

test('group website retains its scope across home, announcements, albums, forum, and events', () => {
  for (const groupId of ['group-one', 'group-two']) {
    for (const language of ['en', 'zh']) {
      const menu = getGroupSiteMenu(language, { canManage: true, canRead: true }, groupId)
      assert.deepEqual(menu.map(item => item.key), ['home', 'announcements', 'albums', 'forum', 'events'])
      assert.equal(menu[3].label, language === 'zh' ? '论坛' : 'Forum')
      for (const item of menu) {
        const url = new URL(item.to, 'https://alife.test')
        const route = getGroupSiteRoute(url.pathname, url.search)
        assert.equal(route?.section, item.key)
        assert.equal(route?.groupId, groupId)
      }
    }
  }
  assert.deepEqual(getGroupSiteRoute('/groups/group-two/albums/album-one'), { section: 'albums', groupId: 'group-two' })
  assert.deepEqual(getGroupSiteRoute('/albums/album-one'), { section: 'albums' })
  assert.deepEqual(getGroupSiteRoute('/groups/forum/posts/post-one', '?categoryId=updates'), { section: 'forum' })
  assert.deepEqual(getGroupSiteRoute('/groups/group-two/forum/posts/post-one'), { section: 'forum', groupId: 'group-two' })
})

test('group management, public forum, and event details remain separate destinations', () => {
  for (const path of ['/groups', '/groups/select', '/groups/join', '/groups/manage', '/forum', '/church/forum', '/groups/group-one/manage', '/groups/group-one/events/event-one']) {
    assert.equal(getGroupSiteRoute(path), null, path)
  }
  for (const section of ['group', 'members', 'contacts', 'subgroups', 'pages', 'albums']) {
    assert.equal(getGroupSiteRoute('/groups', `?section=${section}`), null, section)
  }
})

test('group menu visibility preserves member and manager permissions', () => {
  assert.deepEqual(getGroupSiteMenu('en', { canManage: false, canRead: true }).map(item => item.key), ['home', 'albums', 'forum'])
  assert.deepEqual(getGroupSiteMenu('en', { canManage: false, canRead: false }).map(item => item.key), ['home'])
})

test('Group Life overview is a directory rather than an implicit group site', () => {
  assert.equal(getGroupSiteRoute('/groups', '?view=overview'), null)
  assert.equal(getGroupSiteRoute('/groups', '?q=family&membership=joined'), null)
})

test('directory pagination never resolves a saved group, while legacy content bookmarks keep their scope', () => {
  assert.equal(getLegacyGroupEntryPath('?p=2&membership=joined', 'old-group'), null)
  assert.equal(getLegacyGroupEntryPath('?view=overview', 'old-group'), null)
  assert.equal(getLegacyGroupEntryPath('?section=members', 'old-group'), '/groups/old-group?section=members')
  assert.equal(getLegacyGroupEntryPath('?page=content', 'old-group'), '/groups/old-group?page=content')
  assert.equal(getLegacyGroupEntryPath('?section=members', ''), null)
})
