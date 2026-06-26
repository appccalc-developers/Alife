export type Language = 'en' | 'zh'

export type HomeCopy = {
  nav: {
    about: string
    live: string
    visit: string
    sermons: string
    groups: string
    location: string
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
  liveTitle: string
  liveBody: string
  liveEyebrow: string
  liveCountdownLabel: string
  liveNowLabel: string
  liveChannelLabel: string
  liveOpen: string
  liveUnavailable: string
  visitTitle: string
  visitBody: string
  visitAction: string
  sermonsTitle: string
  sermonsBody: string
  sermonsAction: string
  groupsTitle: string
  groupsBody: string
  groupsAction: string
  eventsTitle: string
  eventsEmpty: string
  eventAction: string
  locationTitle: string
  locationName: string
  locationAddress: string
  openMap: string
  customPageTitle: string
  footerLine: string
}

export const getCopy = (language: Language, churchDescription: string): HomeCopy => {
  if (language === 'zh') {
    return {
      nav: {
        about: '关于我们',
        live: '主日直播',
        visit: '首次来访',
        sermons: '主日信息',
        groups: '小组生活',
        location: '地点',
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
      liveTitle: '主日崇拜直播',
      liveBody: '如果你暂时不能来到现场，可以透过丰盛生命教会的 YouTube 频道一起参与主日崇拜。直播只指向官方账号 @ChineseAbundantLifeChurch。',
      liveEyebrow: 'Sunday Live',
      liveCountdownLabel: '距离下次主日崇拜',
      liveNowLabel: '主日崇拜正在进行或即将开始',
      liveChannelLabel: '官方频道',
      liveOpen: '打开 YouTube 直播',
      liveUnavailable: '未直播时，这里会带你前往官方频道查看最新视频；主日崇拜时会切换到直播入口。',
      visitTitle: '第一次来，也可以很自然。',
      visitBody: '你可以先了解聚会地点、语言环境、现场流程和小组入口。无需先准备好所有答案，只要愿意靠近，我们就在这里欢迎你。',
      visitAction: '查看地点',
      sermonsTitle: '用主日信息继续思想信仰与生活。',
      sermonsBody: '嵌入式视频区域保留空间，方便新朋友先听见教会的语气，也让会友在一周中继续被神的话提醒。',
      sermonsAction: '浏览讲道',
      groupsTitle: '信仰不是只在周日发生。',
      groupsBody: '小组让人可以坐下来分享生活、彼此代祷、一起读经，也在需要时得到真实支持。',
      groupsAction: '寻找小组',
      eventsTitle: '正在发生的事',
      eventsEmpty: '新的公开活动即将发布。你也可以先加入一个小组，认识更多同行的人。',
      eventAction: '查看活动',
      locationTitle: '教会地点',
      locationName: '基督城华人丰盛生命教会',
      locationAddress: 'Christchurch, New Zealand',
      openMap: '在 Google Maps 打开',
      customPageTitle: '教会最新页面',
      footerLine: 'A warm digital doorway for faith, belonging, and service.',
    }
  }

  return {
    nav: {
      about: 'About',
      live: 'Live',
      visit: 'Visit',
      sermons: 'Sermons',
      groups: 'Groups',
      location: 'Location',
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
    liveTitle: 'Sunday Worship Livestream',
    liveBody: 'If you cannot join in person yet, worship with us through the official Chinese Abundant Life Church YouTube channel. The livestream points only to @ChineseAbundantLifeChurch.',
    liveEyebrow: 'Sunday Live',
    liveCountdownLabel: 'Until next Sunday worship',
    liveNowLabel: 'Sunday worship is live or starting soon',
    liveChannelLabel: 'Official channel',
    liveOpen: 'Open YouTube Live',
    liveUnavailable: 'When the church is not live, this opens the latest videos on the official channel; during Sunday worship it points to the live page.',
    visitTitle: 'Your first visit can feel natural.',
    visitBody: 'Start with the gathering location, language environment, what to expect, and how to find a group. You do not need to have every answer ready to be welcomed.',
    visitAction: 'View Location',
    sermonsTitle: 'Let Sunday messages continue into the week.',
    sermonsBody: 'The embedded video space gives visitors a sense of the church voice and helps members keep reflecting on Scripture throughout the week.',
    sermonsAction: 'Browse Sermons',
    groupsTitle: 'Faith does not only happen on Sundays.',
    groupsBody: 'Small groups create a table for sharing life, praying together, reading Scripture, and receiving practical support.',
    groupsAction: 'Find a Group',
    eventsTitle: 'What is happening',
    eventsEmpty: 'New public events will be published soon. You can also begin with a group and meet people walking the same road.',
    eventAction: 'View Event',
    locationTitle: 'Church Location',
    locationName: 'Chinese Abundant Life Church',
    locationAddress: 'Christchurch, New Zealand',
    openMap: 'Open in Google Maps',
    customPageTitle: 'Latest Church Page',
    footerLine: 'A warm digital doorway for faith, belonging, and service.',
  }
}
