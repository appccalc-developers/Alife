export type BibleBookOption = {
  id: string
  zh: string
  en: string
  chapters: number
}

export const bibleBooks: BibleBookOption[] = [
  ['GEN', '创世记', 'Genesis', 50], ['EXO', '出埃及记', 'Exodus', 40], ['LEV', '利未记', 'Leviticus', 27], ['NUM', '民数记', 'Numbers', 36], ['DEU', '申命记', 'Deuteronomy', 34], ['JOS', '约书亚记', 'Joshua', 24], ['JDG', '士师记', 'Judges', 21], ['RUT', '路得记', 'Ruth', 4], ['1SA', '撒母耳记上', '1 Samuel', 31], ['2SA', '撒母耳记下', '2 Samuel', 24], ['1KI', '列王纪上', '1 Kings', 22], ['2KI', '列王纪下', '2 Kings', 25], ['1CH', '历代志上', '1 Chronicles', 29], ['2CH', '历代志下', '2 Chronicles', 36], ['EZR', '以斯拉记', 'Ezra', 10], ['NEH', '尼希米记', 'Nehemiah', 13], ['EST', '以斯帖记', 'Esther', 10], ['JOB', '约伯记', 'Job', 42], ['PSA', '诗篇', 'Psalms', 150], ['PRO', '箴言', 'Proverbs', 31], ['ECC', '传道书', 'Ecclesiastes', 12], ['SNG', '雅歌', 'Song of Songs', 8], ['ISA', '以赛亚书', 'Isaiah', 66], ['JER', '耶利米书', 'Jeremiah', 52], ['LAM', '耶利米哀歌', 'Lamentations', 5], ['EZK', '以西结书', 'Ezekiel', 48], ['DAN', '但以理书', 'Daniel', 12], ['HOS', '何西阿书', 'Hosea', 14], ['JOL', '约珥书', 'Joel', 3], ['AMO', '阿摩司书', 'Amos', 9], ['OBA', '俄巴底亚书', 'Obadiah', 1], ['JON', '约拿书', 'Jonah', 4], ['MIC', '弥迦书', 'Micah', 7], ['NAM', '那鸿书', 'Nahum', 3], ['HAB', '哈巴谷书', 'Habakkuk', 3], ['ZEP', '西番雅书', 'Zephaniah', 3], ['HAG', '哈该书', 'Haggai', 2], ['ZEC', '撒迦利亚书', 'Zechariah', 14], ['MAL', '玛拉基书', 'Malachi', 4],
  ['MAT', '马太福音', 'Matthew', 28], ['MRK', '马可福音', 'Mark', 16], ['LUK', '路加福音', 'Luke', 24], ['JHN', '约翰福音', 'John', 21], ['ACT', '使徒行传', 'Acts', 28], ['ROM', '罗马书', 'Romans', 16], ['1CO', '哥林多前书', '1 Corinthians', 16], ['2CO', '哥林多后书', '2 Corinthians', 13], ['GAL', '加拉太书', 'Galatians', 6], ['EPH', '以弗所书', 'Ephesians', 6], ['PHP', '腓立比书', 'Philippians', 4], ['COL', '歌罗西书', 'Colossians', 4], ['1TH', '帖撒罗尼迦前书', '1 Thessalonians', 5], ['2TH', '帖撒罗尼迦后书', '2 Thessalonians', 3], ['1TI', '提摩太前书', '1 Timothy', 6], ['2TI', '提摩太后书', '2 Timothy', 4], ['TIT', '提多书', 'Titus', 3], ['PHM', '腓利门书', 'Philemon', 1], ['HEB', '希伯来书', 'Hebrews', 13], ['JAS', '雅各书', 'James', 5], ['1PE', '彼得前书', '1 Peter', 5], ['2PE', '彼得后书', '2 Peter', 3], ['1JN', '约翰一书', '1 John', 5], ['2JN', '约翰二书', '2 John', 1], ['3JN', '约翰三书', '3 John', 1], ['JUD', '犹大书', 'Jude', 1], ['REV', '启示录', 'Revelation', 22],
].map(([id, zh, en, chapters]) => ({ id, zh, en, chapters } as BibleBookOption))

export const findBibleBook = (id: string) => bibleBooks.find((book) => book.id === id) || bibleBooks[42]
