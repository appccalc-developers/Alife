# Church Life member website

Church Life is the congregation's website within the existing member workspace. Its dark green title bar contains Home, Sunday Sermons, Announcements, Albums, Forum, and Events in that order. Sermons, bulletins, and events no longer have separate sidebar entries. Existing church management access remains available. The homepage foregrounds recent events and announcements; the former Church content directory stays hidden without deleting saved pages.

The title bar lives outside animated route content. Switching tabs changes only the panel; the title bar, navigation, and group selector remain mounted. Each section's description appears below the title and above the navigation divider. Announcement, album, forum, and event intro cards are removed; applicable actions remain in the content toolbar. `alife-titlebar-controls` carries its own layout and styling without an additional `alife-titlebar-controls-slot` wrapper.

Home, announcements, albums, events, and the forum feed share the owning-group filter. Sermons and detail pages keep the same selector disabled. Tab links preserve `ownerGroupId`; group options stay visible while the next response loads. Forum requests combine the selected owner and category; changing owner retains category and resets pagination. Server authorization and viewer/owner/category/page query keys remain authoritative. Language changes update labels without changing query identity.

Sunday bulletin PDFs appear at the bottom right of sermon cards, with upload controls for authorized managers. Bulletins match the exact video date without an age limit; see [Sunday bulletins](sunday-bulletins.md) and [sermon metadata](sermon-metadata.md) for permissions, normalization, and deployment details. `/church/bulletins` redirects to `/sermons`. Existing sermon and forum detail routes remain supported. Church album browsing uses `/church/groups/:groupId/albums[/albumId]`, retaining the church header and a back link to the directory; ordinary group album routes remain supported separately.

Registered members see all six tabs. Guests see Sunday Sermons and retain public sermon access. Member and manager guards still protect all restricted content and PDF endpoints. The Church Life sidebar heading opens the website directly. On mobile the first tap from another space opens the website; a subsequent tap opens available management navigation. Tabs form one horizontally scrolling row, keep the selected item visible, and support arrow keys, Home/End, and Enter activation.

## Management navigation and access

The Church Life sidebar lists **Church Management → Homepage Management → Visitor Care** in that order. Each entry is independently permission-gated; hiding Church Management must not hide the other two tools from their authorized staff. They are separate management pages rather than congregation website tabs.

| Entry | Canonical route | Access |
| --- | --- | --- |
| Church Management | `/church/manage?section=group` | Existing root-church management access |
| Homepage Management | `/church/homepage` | Page reviewer role or `admin.pages.review`; superadmin retains access |
| Visitor Care | `/church/visit-requests` | `admin.visitRequests.receive`; superadmin retains access |

Church leadership or `admin.access` alone does not grant homepage review or visitor contact access. Signed-in users without the required permission are redirected to Church Life before the protected view mounts. Guests cannot open either tool. Existing API authorization remains authoritative; private visitor responses retain private/no-store caching. API routes and payloads do not change.

Homepage Management and Visitor Care use the member workspace's shared dark green title bar, with their Church Life context and descriptions. They no longer use the system administration frame or appear on its dashboard. Page-review or visitor-reception permission alone no longer exposes the system dashboard; holders of remaining system permissions retain access. Legacy `/admin/page-review` and `/admin/visit-requests` links redirect to the canonical routes while preserving query strings and hashes. Returning from the publication-copy editor opens `/church/homepage`.

Church Management calls its profile leadership section **Church leader / 教会领袖** and its subgroup section **Fellowships & Ministries / 团契与事工**. Profile settings omit explanatory handover text and missing-leader messages. Handover actions appear only for the current approved leader when an approved co-leader is available; existing confirmation and server authorization still apply.

Church Life and Church Management use a persistent body container that retains the greatest measured content height within the current workspace and width. This prevents lazy loading or shorter tabs from collapsing the document and moving its scroll position. Shorter tabs may leave space below their content; changing workspace identity or width resets the measurement. Internal workspace pages reserve scrollbar space. Headers remain outside tab content.

## Acceptance checks

- Switch through all six sections and verify the title bar, tablist, and selector retain the same DOM nodes. The disabled sermon filter must occupy the same position as enabled feed filters.
- During loading and long-to-short tab transitions, verify header geometry and scroll position remain stable in both Church Life and Church Management. Check role-sensitive handover actions, absence of removed guidance, and the renamed sections.
- Choose an owner on Home, visit Forum, then Sermons and return. Verify retained owner, correct forum request scope, and disabled sermon filtering. Category retention and pagination reset must still work.
- Verify descriptions above the divider and the absence of duplicate intro cards. Forum create/refresh controls must remain usable.
- Check member/manager/guest visibility, bulletin upload/read permissions, historical dates, duplicate video dates, legacy bulletin redirects, album details, and browser back/forward.
- At mobile and desktop widths in English and Chinese, verify scrolling tabs, keyboard focus, stable layout, loading/error/empty states, and no language-only data refetch.
- Verify the sidebar order and independent visibility for church leaders, page reviewers, visitor reception staff, ordinary members, and superadmins. Check direct and legacy URLs, editor return navigation, correct Church Life title bars, and that unauthorized routes do not fetch protected content.

## 简体中文

教会生活使用常驻的深绿色标题栏，菜单依次为首页、主日证道、公告、相册、论坛、活动。侧栏不再单列证道、周报或活动，原有管理入口仍按权限显示。各页面说明放在标题下、菜单及横线之上，去掉重复的简介卡片。首页不再显示“教会内容”目录，但保存的页面不删除。

切换菜单仅更新内容区，标题栏、菜单和所属组筛选器保持挂载。首页、公告、相册、活动和论坛共用筛选；证道及详情页保留筛选器并禁用。论坛同时按所属组和分类过滤，换组保留分类并重置页码。周报位于每张证道卡片右下角，管理员可上传 PDF，日期与视频完全对应且无时间限制；旧周报地址跳转到证道页。详情和相册浏览保留网站导航与返回链接。访客可看证道，注册成员显示全部六项菜单，受限内容继续由服务端检查权限。手机菜单单行滚动，支持键盘操作；切换语言不重新获取数据。

教会生活侧栏的管理入口依次为教会管理、首页管理、访客接待，分别按原有权限显示。首页管理需要页面审核角色或 `admin.pages.review`，访客接待需要 `admin.visitRequests.receive`，超级管理员保留访问权；教会管理权限或 `admin.access` 本身不授予这两项权限。两页改用教会生活的深绿色标题栏，移除系统管理中的入口。新地址为 `/church/homepage` 和 `/church/visit-requests`，旧地址保留参数后跳转，审核编辑器返回首页管理。只有这两项职能权限的用户不再进入系统管理。未授权成员在页面加载前返回教会生活，访客不能进入；后端授权、API 和访客资料的私有缓存规则不变。

教会管理的资料页使用“教会领袖”，下属组织菜单改为“团契与事工”。移除职责移交说明及未找到组长的提示；只有当前已批准的领袖在存在已批准的副带领人时看到移交操作，保留确认及服务端授权。教会生活与教会管理的内容容器在同一工作区、同一宽度下保留已测得的最大高度，避免加载或较短页面导致内容收缩及滚动位置跳动；短页面下方可能留白，切换工作区身份或宽度后重新测量。内部页面预留滚动条空间，标题栏位于内容容器之外。

## 繁體中文

教會管理的資料頁使用「教會領袖」，下屬組織選單改為「團契與事工」。移除職責移交說明及未找到組長的提示；只有目前已批准的領袖在存在已批准的副帶領人時看到移交操作，保留確認及伺服器授權。教會生活與教會管理的內容容器在同一工作區、同一寬度下保留已測得的最大高度，避免載入或較短頁面導致內容收縮及捲動位置跳動；短頁面下方可能留白，切換工作區身分或寬度後重新測量。內部頁面預留捲軸空間，標題欄位於內容容器之外。

教會生活使用常駐的深綠色標題欄，選單依次為首頁、主日證道、公告、相冊、論壇、活動。側欄不再單列證道、週報或活動，原有管理入口仍按權限顯示。各頁面說明放在標題下、選單及橫線之上，移除重複的簡介卡片。首頁不再顯示「教會內容」目錄，但儲存的頁面不刪除。

教會生活側欄的管理入口依次為教會管理、首頁管理、訪客接待，分別按原有權限顯示。首頁管理需要頁面審核角色或 `admin.pages.review`，訪客接待需要 `admin.visitRequests.receive`，超級管理員保留存取權；教會管理權限或 `admin.access` 本身不授予這兩項權限。兩頁改用教會生活的深綠色標題欄，移除系統管理中的入口。新網址為 `/church/homepage` 和 `/church/visit-requests`，舊網址保留參數後轉往新頁，審核編輯器返回首頁管理。只有這兩項職能權限的使用者不再進入系統管理。未授權成員在頁面載入前返回教會生活，訪客不能進入；後端授權、API 和訪客資料的私有快取規則不變。

切換選單僅更新內容區，標題欄、選單和所屬組篩選器保持掛載。首頁、公告、相冊、活動和論壇共用篩選；證道及詳情頁保留篩選器並停用。論壇同時按所屬組和分類篩選，換組保留分類並重設頁碼。週報位於每張證道卡片右下角，管理員可上傳 PDF，日期與影片完全對應且無時間限制；舊週報網址轉往證道頁。詳情和相冊瀏覽保留網站導覽與返回連結。訪客可看證道，註冊成員顯示全部六項選單，受限內容繼續由伺服器檢查權限。手機選單單行捲動，支援鍵盤及中英文切換；切換語言不重新取得資料。
