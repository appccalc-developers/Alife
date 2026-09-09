import type { ChurchSiteSection } from '../../app/navigation/churchSiteNavigation'

export const churchSiteDescription = (section: ChurchSiteSection | null, language: string) => {
  const descriptions = {
    sermons: ['聆听主日证道，查看同一主日的周报。', 'Listen to Sunday sermons and read the bulletin for the same date.'],
    announcements: ['关注教会与事工的最新公告。', 'Keep up with announcements from the church and its ministries.'],
    albums: ['浏览教会与事工相册，一起回顾相聚的时光。', 'Explore church and ministry albums and revisit moments shared together.'],
    forum: ['面向全教会成员的分享空间，用来交流见证、问题、资源和近况。', 'A shared space for church members to exchange stories, questions, resources, and updates.'],
    events: ['浏览教会与事工已批准的活动，一起参与相聚。', 'Explore approved church and ministry events and join in.'],
  }
  const copy = section && section in descriptions ? descriptions[section as keyof typeof descriptions]
    : ['一起聆听主日信息，关注教会近况，分享生活中的点滴。', 'Listen to Sunday messages, catch up on church news, and share in everyday life together.']
  return copy[language === 'zh' ? 0 : 1]
}
