import type { Language } from '../../i18n/locale'

export type { Language }

export type HomeCopy = {
  nav: {
    welcome: string
    about: string
    live: string
    visit: string
    life: string
    sermons: string
    articles: string
    groups: string
    ministries: string
    events: string
    location: string
  }
  sectionFallback: {
    intro: string
    highlight: string
    info: string
    events: string
    groups: string
    pages: string
    members: string
    list: string
    sermon: string
    section: string
  }
  account: string
  enterAlife: string
  churchName: string
  heroKicker: string
  heroTitle: string
  heroBody: string
  heroPrimary: string
  heroSecondary: string
  heroScroll: string
  heroWorship: string
  heroLocation: string
  heroMetaOne: string
  heroMetaTwo: string
  heroMetaThree: string
  contemplationTitle: string
  contemplationBody: string
  contemplationOne: string
  contemplationTwo: string
  contemplationThree: string
  visitContactAction: string
  visitContactTitle: string
  visitContactBody: string
  visitContactName: string
  visitContactEmail: string
  visitContactPhone: string
  visitContactPhonePlaceholder: string
  visitContactPhoneHint: string
  visitContactCountryCode: string
  visitContactLanguage: string
  visitContactMessage: string
  visitContactSubmit: string
  visitContactSuccess: string
  visitContactSuccessTitle: string
  visitContactConfirm: string
  visitContactError: string
  visitContactClose: string
  visitContactHint: string
  visitContactNameRequired: string
  visitContactMessageRequired: string
  visitContactEmailInvalid: string
  visitContactPhoneInvalid: string
  liveTitle: string
  liveBody: string
  liveEyebrow: string
  liveCountdownLabel: string
  liveNowLabel: string
  liveChannelLabel: string
  liveOpen: string
  liveWatchLatestVideos: string
  liveUnavailable: string
  liveCountdownDayShort: string
  liveCountdownHourShort: string
  liveCountdownMinuteShort: string
  liveCountdownSecondShort: string
  visitTitle: string
  visitBody: string
  visitAction: string
  sermonsTitle: string
  sermonsBody: string
  sermonsAction: string
  groupsTitle: string
  groupsBody: string
  groupsAction: string
  groupsEyebrow: string
  groupsEmptyState: string
  groupsBadgePublic: string
  groupsBadgePrivate: string
  organizationTitle: string
  organizationBody: string
  organizationAction: string
  organizationEyebrow: string
  organizationEmptyState: string
  organizationBadge: string
  ministriesTitle: string
  ministriesBody: string
  ministriesAction: string
  ministriesEyebrow: string
  ministriesEmptyState: string
  ministriesBadge: string
  eventsTitle: string
  eventsEyebrow: string
  eventsLead: string
  eventsEmpty: string
  eventsViewAll: string
  eventsTimeTbd: string
  eventsFeaturedCurrent: string
  eventsFeaturedSingle: string
  eventsDetailsFallback: string
  eventsLocationFallback: string
  eventsOpen: string
  eventsPreparingTitle: string
  eventAction: string
  recentSermonsEyebrow: string
  recentSermonsLatestBadge: string
  recentSermonsFallbackMeta: string
  recentSermonsItemFallback: string
  recentSermonsEmpty: string
  loginPromptTitle: string
  loginPromptBody: string
  loginPromptLogin: string
  loginPromptCancel: string
  loginPromptCloseAria: string
  locationTitle: string
  locationName: string
  locationAddress: string
  locationContactNameLabel: string
  locationContactPhoneLabel: string
  openMap: string
  customPageTitle: string
  homepageLoading: string
  homepageEmpty: string
  homepageUnavailable: string
  footerLine: string
}

export const getCopy = (language: Language, churchDescription: string): HomeCopy => {
  if (language === 'zh') {
    return {
      nav: {
        welcome: '欢迎',
        about: '关于我们',
        live: '主日直播',
        visit: '首次来访',
        life: '教会生活',
        sermons: '主日信息',
        articles: '历史文章',
        groups: '小组生活',
        ministries: '事工',
        events: '近期活动',
        location: '地点',
      },
      sectionFallback: {
        intro: '首页介绍',
        highlight: '重点内容',
        info: '说明',
        events: '近期活动',
        groups: '小组生活',
        pages: '页面',
        members: '成员',
        list: '列表',
        sermon: '主日信息',
        section: '内容',
      },
      account: '登录',
      enterAlife: '进入 Alife',
      churchName: '基督城华人丰盛生命教会',
      heroKicker: 'Christchurch Chinese Christian Community',
      heroTitle: '在南岛的光里，\n找到一个属灵的家。',
      heroBody: '我们是一群在基督城同行的华人基督徒，欢迎留学生、年轻家庭、新移民和正在寻找信仰答案的朋友，一起敬拜、认识耶稣、进入真实的团契生活。',
      heroPrimary: '计划首次来访',
      heroSecondary: '观看主日信息',
      heroScroll: '向下探索',
      heroWorship: '主日崇拜 10:00 AM',
      heroLocation: 'Wigram, Christchurch',
      heroMetaOne: '双语同行',
      heroMetaTwo: '小组关怀',
      heroMetaThree: '城市见证',
      contemplationTitle: '欢迎你在主日来到神的家。',
      contemplationBody: churchDescription || '每个主日，我们一起敬拜、聆听神的话、彼此问候，也为基督城这座城市祷告。无论你是第一次来到教会，还是已经在信仰路上走了很久，这里都盼望成为你认识耶稣、找到属灵家人的地方。',
      contemplationOne: '敬拜：在诗歌、祷告和圣经信息中，把心重新转向神。',
      contemplationTwo: '团契：主日之后留下来认识朋友，也可以进入适合的小组生活。',
      contemplationThree: '关怀：我们欢迎留学生、家庭、新移民和正在探索信仰的朋友。',
      visitContactAction: '我想来看看',
      visitContactTitle: '留下联系方式',
      visitContactBody: '如果你想参观、参加主日崇拜，或只是先感受一下教会，我们会安排同工与你联系。',
      visitContactName: '您希望我们称呼您',
      visitContactEmail: '邮箱',
      visitContactPhone: '电话号码',
      visitContactPhonePlaceholder: '手机号码',
      visitContactPhoneHint: '请至少留下邮箱或电话其中一种',
      visitContactCountryCode: '区号',
      visitContactLanguage: '偏好语言',
      visitContactMessage: '想了解什么',
      visitContactSubmit: '提交联系方式',
      visitContactSuccess: '已经收到，我们会尽快联系你。',
      visitContactSuccessTitle: '提交成功',
      visitContactConfirm: '我知道了',
      visitContactError: '提交失败，请稍后再试。',
      visitContactClose: '关闭',
      visitContactHint: '请至少留下邮箱或电话其中一种',
      visitContactNameRequired: '请输入姓名',
      visitContactMessageRequired: '请输入留言',
      visitContactEmailInvalid: '请输入有效的邮箱地址',
      visitContactPhoneInvalid: '请输入有效的电话号码',
      liveTitle: '主日崇拜直播',
      liveBody: '如果你暂时不能来到现场，可以透过丰盛生命教会的 YouTube 频道一起参与主日崇拜。直播只指向官方账号 @ChineseAbundantLifeChurch。',
      liveEyebrow: 'Sunday Live',
      liveCountdownLabel: '距离下次主日崇拜',
      liveNowLabel: '主日崇拜正在进行或即将开始',
      liveChannelLabel: '官方频道',
      liveOpen: '打开 YouTube 直播',
      liveWatchLatestVideos: '观看最新视频',
      liveUnavailable: '未直播时，这里会带你前往官方频道查看最新视频；主日崇拜时会切换到直播入口。',
      liveCountdownDayShort: '天',
      liveCountdownHourShort: '时',
      liveCountdownMinuteShort: '分',
      liveCountdownSecondShort: '秒',
      visitTitle: '第一次来，也可以很自然。',
      visitBody: '你可以先了解聚会地点、语言环境、现场流程和小组入口。无需先准备好所有答案，只要愿意靠近，我们就在这里欢迎你。',
      visitAction: '查看地点',
      sermonsTitle: '用主日信息继续思想信仰与生活。',
      sermonsBody: '嵌入式视频区域保留空间，方便新朋友先听见教会的语气，也让会友在一周中继续被神的话提醒。',
      sermonsAction: '浏览讲道',
      groupsTitle: '信仰不是只在周日发生。',
      groupsBody: '小组让人可以坐下来分享生活、彼此代祷、一起读经，也在需要时得到真实支持。',
      groupsAction: '寻找小组',
      groupsEyebrow: '小组生活',
      groupsEmptyState: '公开小组同步后，会在这里自动展示适合了解和加入的小组。',
      groupsBadgePublic: '公开可了解',
      groupsBadgePrivate: '小组空间',
      organizationTitle: '认识构成这个属灵家的群体。',
      organizationBody: '这些经过审核的页面介绍教会的组成、群体和服事关系，帮助你在来访前先认识我们。',
      organizationAction: '打开页面',
      organizationEyebrow: '教会组成',
      organizationEmptyState: '审核员指定“教会组成”一级菜单后，这里会展示其中的公开页面。',
      organizationBadge: '已审核页面',
      ministriesTitle: '一同参与教会事工。',
      ministriesBody: '已审核的事工页面会在这里展示异象、服事内容和联系入口，帮助你更快找到可以参与的地方。',
      ministriesAction: '打开事工',
      ministriesEyebrow: '事工',
      ministriesEmptyState: '事工页面通过发布审核后，会在这里自动展示图片和简介。',
      ministriesBadge: '已审核事工',
      eventsTitle: '正在发生的事',
      eventsEyebrow: '近期活动',
      eventsLead: '选一个时间，走进真实发生的相聚。',
      eventsEmpty: '新的公开活动即将发布。你也可以先加入一个小组，认识更多同行的人。',
      eventsViewAll: '查看全部活动',
      eventsTimeTbd: '时间待确认',
      eventsFeaturedCurrent: '当前活动',
      eventsFeaturedSingle: '精选活动',
      eventsDetailsFallback: '活动详情即将补充。你可以先查看全部活动，找到适合加入的时间。',
      eventsLocationFallback: '教会与小组空间',
      eventsOpen: '打开活动',
      eventsPreparingTitle: '公开活动正在预备中',
      eventAction: '查看活动',
      recentSermonsEyebrow: '近期讲道',
      recentSermonsLatestBadge: '最新信息',
      recentSermonsFallbackMeta: '主日讲道',
      recentSermonsItemFallback: '讲道',
      recentSermonsEmpty: '近期讲道同步后，会在这里自动展示最新信息。',
      loginPromptTitle: '需要登录',
      loginPromptBody: '请先登录或注册后再继续操作。',
      loginPromptLogin: '前往登录',
      loginPromptCancel: '取消',
      loginPromptCloseAria: '关闭',
      locationTitle: '教会地点',
      locationName: '基督城华人丰盛生命教会',
      locationAddress: 'Christchurch, New Zealand',
      locationContactNameLabel: '问询联系人',
      locationContactPhoneLabel: '联系电话',
      openMap: '在 Google Maps 打开',
      customPageTitle: '教会最新页面',
      homepageLoading: '正在加载主页',
      homepageEmpty: '目前还没有可显示的公开主页。',
      homepageUnavailable: '主页暂时无法加载，请稍后再试。',
      footerLine: 'A warm digital doorway for faith, belonging, and service.',
    }
  }

  return {
    nav: {
      welcome: 'Welcome',
      about: 'About',
      live: 'Live',
      visit: 'Visit',
      life: 'Life',
      sermons: 'Sermons',
      articles: 'Archive',
      groups: 'Groups',
      ministries: 'Ministries',
      events: 'Events',
      location: 'Location',
    },
    sectionFallback: {
      intro: 'Intro',
      highlight: 'Highlight',
      info: 'Info',
      events: 'Events',
      groups: 'Groups',
      pages: 'Pages',
      members: 'Members',
      list: 'List',
      sermon: 'Sermon',
      section: 'Section',
    },
    account: 'Log in',
    enterAlife: 'Enter Alife',
    churchName: 'Chinese Abundant Life Church',
    heroKicker: 'Christchurch Chinese Christian Community',
    heroTitle: 'A spiritual home\nin the light of the South Island.',
    heroBody: 'We are a Chinese Christian community in Christchurch, welcoming students, families, new migrants, and seekers to worship, know Jesus, and grow in real fellowship.',
    heroPrimary: 'Plan a Visit',
    heroSecondary: 'Watch Sermon',
    heroScroll: 'Explore below',
    heroWorship: 'Sunday Worship 10:00 AM',
    heroLocation: 'Wigram, Christchurch',
    heroMetaOne: 'Bilingual care',
    heroMetaTwo: 'Small groups',
    heroMetaThree: 'City witness',
    contemplationTitle: 'You are welcome in the house of God this Sunday.',
    contemplationBody: churchDescription || 'Every Sunday we gather to worship, hear God\u2019s word, greet one another, and pray for Christchurch. Whether this is your first time visiting church or you have followed Jesus for years, we hope this can become a place where you know Christ and find spiritual family.',
    contemplationOne: 'Worship: songs, prayer, and Scripture help us turn our hearts back to God.',
    contemplationTwo: 'Fellowship: stay after service to meet people and find a small group.',
    contemplationThree: 'Care: students, families, new migrants, and seekers are warmly welcomed.',
    visitContactAction: 'I would like to visit',
    visitContactTitle: 'Leave your contact details',
    visitContactBody: 'If you would like to visit, join Sunday worship, or simply get a feel for the church, our welcome team can contact you.',
    visitContactName: 'What should we call you?',
    visitContactEmail: 'Email',
    visitContactPhone: 'Phone number',
    visitContactPhonePlaceholder: 'Phone number',
    visitContactPhoneHint: 'Please leave at least email or phone',
    visitContactCountryCode: 'Country code',
    visitContactLanguage: 'Preferred language',
    visitContactMessage: 'What would you like to know?',
    visitContactSubmit: 'Submit contact details',
    visitContactSuccess: 'Thanks, we received your request and will contact you soon.',
    visitContactSuccessTitle: 'Submitted successfully',
    visitContactConfirm: 'Got it',
    visitContactError: 'Unable to submit right now. Please try again later.',
    visitContactClose: 'Close',
    visitContactHint: 'Please leave at least email or phone',
    visitContactNameRequired: 'Please enter your name',
    visitContactMessageRequired: 'Please enter a message',
    visitContactEmailInvalid: 'Please enter a valid email address',
    visitContactPhoneInvalid: 'Please enter a valid phone number',
    liveTitle: 'Sunday Worship Livestream',
    liveBody: 'If you cannot join in person yet, worship with us through the official Chinese Abundant Life Church YouTube channel. The livestream points only to @ChineseAbundantLifeChurch.',
    liveEyebrow: 'Sunday Live',
    liveCountdownLabel: 'Until next Sunday worship',
    liveNowLabel: 'Sunday worship is live or starting soon',
    liveChannelLabel: 'Official channel',
    liveOpen: 'Open YouTube Live',
    liveWatchLatestVideos: 'Watch Latest Videos',
    liveUnavailable: 'When the church is not live, this opens the latest videos on the official channel; during Sunday worship it points to the live page.',
    liveCountdownDayShort: 'D',
    liveCountdownHourShort: 'H',
    liveCountdownMinuteShort: 'M',
    liveCountdownSecondShort: 'S',
    visitTitle: 'Your first visit can feel natural.',
    visitBody: 'Start with the gathering location, language environment, what to expect, and how to find a group. You do not need to have every answer ready to be welcomed.',
    visitAction: 'View Location',
    sermonsTitle: 'Let Sunday messages continue into the week.',
    sermonsBody: 'The embedded video space gives visitors a sense of the church voice and helps members keep reflecting on Scripture throughout the week.',
    sermonsAction: 'Browse Sermons',
    groupsTitle: 'Faith does not only happen on Sundays.',
    groupsBody: 'Small groups create a table for sharing life, praying together, reading Scripture, and receiving practical support.',
    groupsAction: 'Find a Group',
    groupsEyebrow: 'Group Life',
    groupsEmptyState: 'Public groups will appear here automatically once they are available.',
    groupsBadgePublic: 'Open to explore',
    groupsBadgePrivate: 'Group space',
    organizationTitle: 'Meet the communities that form this spiritual home.',
    organizationBody: 'These reviewed pages introduce the church’s communities, teams, and relationships before your first visit.',
    organizationAction: 'Open Page',
    organizationEyebrow: 'Church Organization',
    organizationEmptyState: 'Reviewed public pages will appear here after a primary menu is assigned to Church Organization.',
    organizationBadge: 'Reviewed page',
    ministriesTitle: 'Serve with the life of the church.',
    ministriesBody: 'Approved ministry pages introduce each team’s vision, service rhythm, and next step so people can find where to participate.',
    ministriesAction: 'Open Ministry',
    ministriesEyebrow: 'Ministries',
    ministriesEmptyState: 'Approved ministry pages will appear here automatically with their card image and summary.',
    ministriesBadge: 'Approved ministry',
    eventsTitle: 'What is happening',
    eventsEyebrow: 'Upcoming Events',
    eventsLead: 'Choose a time, see the story, and step into the next gathering.',
    eventsEmpty: 'New public events will be published soon. You can also begin with a group and meet people walking the same road.',
    eventsViewAll: 'View all events',
    eventsTimeTbd: 'Time to be confirmed',
    eventsFeaturedCurrent: 'Featured event',
    eventsFeaturedSingle: 'Featured gathering',
    eventsDetailsFallback: 'Details are being prepared. View all events to find the next gathering you can join.',
    eventsLocationFallback: 'Church and group space',
    eventsOpen: 'Open event',
    eventsPreparingTitle: 'Public events are being prepared',
    eventAction: 'View Event',
    recentSermonsEyebrow: 'Recent Sermons',
    recentSermonsLatestBadge: 'Latest Message',
    recentSermonsFallbackMeta: 'Sunday sermon',
    recentSermonsItemFallback: 'Sermon',
    recentSermonsEmpty: 'Recent sermons will appear here automatically after the sermon list is synced.',
    loginPromptTitle: 'Login Required',
    loginPromptBody: 'Please log in or sign up to continue.',
    loginPromptLogin: 'Go to Login',
    loginPromptCancel: 'Cancel',
    loginPromptCloseAria: 'Close',
    locationTitle: 'Church Location',
    locationName: 'Chinese Abundant Life Church',
    locationAddress: 'Christchurch, New Zealand',
    locationContactNameLabel: 'Inquiry contact',
    locationContactPhoneLabel: 'Phone',
    openMap: 'Open in Google Maps',
    customPageTitle: 'Latest Church Page',
    homepageLoading: 'Loading homepage',
    homepageEmpty: 'No public homepage is available yet.',
    homepageUnavailable: 'The homepage is temporarily unavailable. Please try again later.',
    footerLine: 'A warm digital doorway for faith, belonging, and service.',
  }
}
