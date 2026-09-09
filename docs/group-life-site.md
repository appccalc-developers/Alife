# Group Life member website

Group Life combines Home, Announcements, Albums, Forum, and Events in that order beneath a persistent dark title bar, using the same navigation component as [Church Life](church-life-site.md). The forum tab is labelled **Forum / 论坛**. The title bar remains outside animated route content, so switching these sections does not remount it. Section descriptions appear beneath the group name and above the menu. Tabs scroll on narrow screens and support keyboard focus and activation.

The sidebar retains Group Management according to existing permissions. Announcements, albums, forum, and events appear in the website menu instead of separate sidebar entries. Group Management no longer shows a pending-review badge; membership review itself is unchanged.

Group Management calls its child-group section **Ministries / 事工**, and creates only ministry groups; the backend enforces this rule. Historical child fellowships remain accessible and labelled. Its duplicate Albums entry/panel is removed; Group Life retains album functionality. Legacy management `section=albums` links return to profile. See [Group types](group-types.md) for persistence, creation compatibility, and migration requirements.

简体：小组管理的“下属小组”改为“事工”，仅可新增事工组，由后端强制校验；历史下属团契保留并标明类型。移除管理页重复的相册入口及面板，小组生活相册功能保留；旧管理 `section=albums` 链接回到资料页。类型、创建兼容性和迁移要求见 [Group types](group-types.md)。

繁體：小組管理的「下屬小組」改為「事工」，僅可新增事工組，由後端強制校驗；歷史下屬團契保留並標明類型。移除管理頁重複的相冊入口及面板，小組生活相冊功能保留；舊管理 `section=albums` 連結回到資料頁。類型、建立相容性和遷移要求見 [Group types](group-types.md)。

**Switch group** and **Manage group** are direct actions on the right of the persistent Group Life title bar. The management action appears only for existing group managers and keeps the displayed group's scope, including explicit group URLs. Both actions stay in place when switching website tabs; they no longer appear in the overview's overflow menu. On narrow screens they use labelled icon buttons with accessible names.

The group management Members view contains three independent collapsible lists: Pending, Active members, and Inactive members. Each summary always shows its count. Lists start collapsed and can be opened with a pointer, Enter, or Space; empty categories show an explanatory message. Expanding or collapsing a list does not reload memberships or change permissions. Approval, role, profile, and removal controls remain inside their existing member rows. Expansion survives language-only changes while the view remains mounted.

Existing access rules remain intact: group managers see announcements and events management; approved group members and administrators see albums and forum. The home tab remains the member-facing overview. The menu uses existing route and API guards and does not grant additional permissions. Current-group routes (`/groups?view=overview`, `/groups?section=announcements`, `/albums`, `/groups/forum`, `/groups?section=events`) and explicit `/groups/:groupId` equivalents retain the same group across navigation. Management and event details stay separate working areas. Album and forum post details retain the site header and their own detail title/back link. Forum create/refresh actions remain with the category filter, and existing group-scoped requests, category filtering, and pagination remain intact.

No API, authorization, persistence, or cache contract changes are required for this navigation change. Header group data is keyed by viewer and group, not language. Verify all five sections as a manager, member album/forum access, sidebar badge removal, explicit-group links, forum post detail/back navigation, keyboard navigation, and title-bar DOM identity at mobile/desktop widths in English and Chinese.

Group profile settings omit general handover instructions, missing-leader notices, and unavailable handover controls. The current approved leader still sees actions for eligible approved co-leaders, with existing confirmation and authorization. Group selection lists and tree details show the viewer's approved role (Group leader, Co-leader, or Group member) instead of Joined. Non-members see Available to join; pending, invited, and guest states remain explicit. The enter action sits inside expanded details, with the former explanatory footer and divider removed. Previewing details still does not switch the active group.

Group Life and Group Management retain the greatest measured body height within the current viewer/group workspace and width, so lazy loading or shorter tabs do not collapse the document or move its scroll position. Shorter tabs may leave space below the content. Changing workspace identity or width resets the measurement; internal pages reserve scrollbar space. Verify long-to-short tab transitions during loading, at desktop and mobile widths, alongside the role labels and handover visibility.

Also verify header action placement, manager/member visibility, the explicit-group management target, all three category counts, empty categories, independent expansion, keyboard operation, and that toggling categories does not trigger membership requests.

简体：小组生活顶部菜单依次为首页、公告、相册、论坛、活动，其中论坛标签为“论坛”。切换菜单只更新内容区，标题栏不重新挂载；说明位于组名下、菜单上。侧栏保留小组管理，移除小组管理的待审核角标，审核功能不变。公告及活动管理仍限原有管理权限，相册和论坛仍限已批准成员或管理员。当前小组与指定小组的导航保持各自的小组范围；管理和活动详情仍为独立工作区，相册及帖子详情保留网站标题栏、详情标题与返回链接。论坛发帖及刷新操作位于分类筛选旁，原有小组范围、分类及分页不变。手机菜单单行滚动，支持键盘及中英文切换，不因语言变化重新获取数据。

“切换小组”和“管理小组”移到常驻标题栏右侧，移除总览中的重复菜单；管理按钮仅对原有管理权限开放，并保留指定小组范围，手机使用带无障碍名称的图标按钮。成员页按待审批、活跃成员、非活跃三类显示人数和独立的伸缩列表，默认收起，支持点击及 Enter、空格键。空分类有提示，展开收起不重新读取成员；原有审批、角色、资料与移除权限不变。页面保持挂载时，切换语言保留展开状态。

资料页移除移交职责的泛化说明、未找到组长的提示及不可用的移交操作；只有当前已批准的组长看到移交给合格副组长的操作，保留确认与原有授权。选择小组的列表及组织树按实际身份显示组长、副组长、组员或可以申请加入，保留申请中、受邀和访客状态。进入按钮移到展开详情内，移除底部分隔线及说明，展开详情仍不切换当前小组。小组生活与小组管理在同一用户和小组、同一宽度下保留内容区已测得的最大高度，避免加载和长短页面切换造成滚动跳动；短页面下方可能留白，切换工作区身份或宽度后重新测量，内部页面预留滚动条空间。

繁體：小組生活頂部選單依次為首頁、公告、相冊、論壇、活動，其中論壇標籤為「論壇」。切換選單只更新內容區，標題欄不重新掛載；說明位於組名下、選單上。側欄保留小組管理，移除小組管理的待審核角標，審核功能不變。公告及活動管理仍限原有管理權限，相冊和論壇仍限已批准成員或管理員。目前小組與指定小組的導覽保持各自的小組範圍；管理和活動詳情仍為獨立工作區，相冊及帖子詳情保留網站標題欄、詳情標題與返回連結。論壇發帖及重新整理操作位於分類篩選旁，原有小組範圍、分類及分頁不變。手機選單單行捲動，支援鍵盤及中英文切換，不因語言變化重新取得資料。

「切換小組」和「管理小組」移到常駐標題欄右側，移除總覽中的重複選單；管理按鈕僅對原有管理權限開放，並保留指定小組範圍，手機使用帶無障礙名稱的圖示按鈕。成員頁按待審批、活躍成員、非活躍三類顯示人數和獨立的伸縮列表，預設收起，支援點擊及 Enter、空白鍵。空分類有提示，展開收起不重新讀取成員；原有審批、角色、資料與移除權限不變。頁面保持掛載時，切換語言保留展開狀態。

資料頁移除移交職責的泛化說明、未找到組長的提示及不可用的移交操作；只有目前已批准的組長看到移交給合格副組長的操作，保留確認與原有授權。選擇小組的列表及組織樹按實際身分顯示組長、副組長、組員或可以申請加入，保留申請中、受邀和訪客狀態。進入按鈕移到展開詳情內，移除底部分隔線及說明，展開詳情仍不切換目前小組。小組生活與小組管理在同一使用者和小組、同一寬度下保留內容區已測得的最大高度，避免載入和長短頁面切換造成捲動跳動；短頁面下方可能留白，切換工作區身分或寬度後重新測量，內部頁面預留捲軸空間。
