import type { ContentPostCategory } from '../../types/contentPost'

export const contentPostCategories: ContentPostCategory[] = [
  'news',
  'sermonOutline',
  'testimony',
  'learning',
  'general',
]

const categoryLabels: Record<ContentPostCategory, { en: string; zh: string }> = {
  news: { en: 'Church news', zh: '教会新闻' },
  sermonOutline: { en: 'Sermon notes', zh: '讲章文字' },
  testimony: { en: 'Testimonies', zh: '生命见证' },
  learning: { en: 'Learning', zh: '学习资料' },
  general: { en: 'Other', zh: '其他文章' },
}

export const contentPostCategoryLabel = (category: ContentPostCategory, language: string) =>
  language === 'zh' ? categoryLabels[category].zh : categoryLabels[category].en

export const articleCopy = (language: string) => language === 'zh'
  ? {
      archive: '历史文章',
      eyebrow: '教会资料库',
      title: '在过去的分享中，继续看见神的带领。',
      description: '这里保存教会新闻、讲章文字、生命见证和学习资料。所有内容均来自教会历史网站，并按原始发布日期排列。',
      all: '全部文章',
      articleCount: '篇文章',
      readArticle: '阅读全文',
      loadMore: '显示更多',
      loading: '正在读取历史文章…',
      loadErrorTitle: '暂时无法读取文章',
      loadErrorBody: '请稍后再试，或返回首页。',
      retry: '重新读取',
      emptyTitle: '这个分类暂时没有公开文章',
      emptyBody: '部分历史资料仍在人工复核，完成后会出现在这里。',
      backToArchive: '返回历史文章',
      detailLoading: '正在读取文章…',
      detailErrorTitle: '找不到这篇文章',
      detailErrorBody: '文章可能仍在复核、尚未发布，或网址已经失效。',
      source: '查看原始来源',
      published: '发布于',
      byline: '作者',
    }
  : {
      archive: 'Archive',
      eyebrow: 'Church archive',
      title: 'See God’s faithfulness through stories shared over the years.',
      description: 'Explore church news, sermon notes, testimonies, and learning resources preserved from the former church website.',
      all: 'All articles',
      articleCount: 'articles',
      readArticle: 'Read article',
      loadMore: 'Show more',
      loading: 'Loading the archive…',
      loadErrorTitle: 'The archive is temporarily unavailable',
      loadErrorBody: 'Please try again shortly or return to the home page.',
      retry: 'Try again',
      emptyTitle: 'No public articles in this category yet',
      emptyBody: 'Some historical material is still under review and will appear here when ready.',
      backToArchive: 'Back to archive',
      detailLoading: 'Loading article…',
      detailErrorTitle: 'This article could not be found',
      detailErrorBody: 'It may still be under review, unpublished, or the link may no longer be valid.',
      source: 'View original source',
      published: 'Published',
      byline: 'By',
    }
