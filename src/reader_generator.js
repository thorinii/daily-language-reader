const chunkArray = require('lodash/chunk')
const _ = require('lodash')

const {
  loadPassage,
  loadPassageIndex,
  loadIndexByIds,
  loadTokenFrequencyMap,
  isProperNoun,
} = require('./ognt_dataset.js')

const {
  loadPersistentState,
  executeWithPersistentState,
} = require('./persistence.js')

const {
  renderPassage,
  formatAsText,
  formatAsHtml,
} = require('./renderer.js')


// TODO: order English sequences
main(process.argv.slice(2)).catch(e => console.warn('error:', e))


const NEW_WORDS_PER_DAY = 3
const MAX_WORDS_LEARNING = 10
const LEARNING_INTERVAL = 4
const MAX_SIMULTANEOUS_RECALL = 6
const EXAMPLES_PER_WORD = 5
const ISLAND = ['1 John']
const EXTENSIVE_WORD_COUNT = 100

const lesson = {
  date: new Date(),
  recall: [
    {
      word: 'tau',
      examples: [
        {
          reference: 'Matthew 13:28',
          text: '',
          inline: '',
        },
      ],
    },
    {
      word: 'ksero',
      definition: 'I know, as in, I know where he is / ksero pou ine',
      translations: ['know', 'I know', 'am knowing'],
      examples: [
        {
          reference: '1 Timothy 2:8',
          text: '',
          inline: '',
          translation: '',
        },
      ],
    },
  ],
  learn: [
    {
      word: 'ksero',
      definition: 'I know, as in, I know where he is / ksero pou ine',
      translations: ['know', 'I know', 'am knowing'],
      examples: [
        {
          reference: '1 Timothy 2:8',
          text: '',
          inline: '',
          translation: '',
        },
      ],
    },
  ],
  achievedVerses: [
    {
      fraction: 1,
      reference: '1 Timothy 2:8',
      text: '',
      inline: '',
    },
    {
      fraction: 0.92,
      reference: 'Philemon 1:3',
      text: '',
      inline: '',
    },
  ],
  extensiveReading: {
    reference: '1 John 1:4-13',
    text: '',
  },
  statistics: {
    wordsLearning: 7,
    wordsKnown: 32,
    versesAchieved: 11,
    islandKnownFraction: 0.3,
  },
}

function renderLessonText (lesson) {
  let text = ''
  text += '# GLiB lesson - ' + formatDate(lesson.date) + '\n'
  text += '\n'

  text += '## Recall\n'
  text += lesson.recall.map(w => {
    return '### ' + w.word +
      w.examples.map(e => '\n' + renderVerse(e))
        .join('\n')
  })
    .join('\n')

  text += '\n\n'

  text += '## Learn\n'
  text += lesson.learn.map(w => {
    return '### ' + w.word + '\n' +
      'Definition: ' + w.definition + '\n' +
      'Translations: ' + w.translations.join('; ') + '\n' +
      w.examples.map(e => '\n' + renderVerse(e))
        .join('\n')
  })
    .join('\n')

  text += '\n\n'

  text += '## Achieved verses\n'
  text += lesson.achievedVerses.map(v => {
    return renderVerse(v)
  })
    .join('\n\n')

  text += '\n\n'

  text += '## Reading\n'
  text += renderVerse(lesson.extensiveReading)

  text += '\n\n'

  text += '## Stats\n'
  text += lesson.statistics.wordsLearning + ' words learning\n'
  text += lesson.statistics.wordsKnown + ' words known\n'
  text += lesson.statistics.versesAchieved + ' verses achieved\n'
  text += (100 * lesson.statistics.islandKnownFraction).toFixed(0) + '% known of island\n'

  return text.trim()
}

function renderVerse (verse) {
  return verse.reference + '\n' +
    [verse.text, verse.inline, verse.translation]
      .filter(t => t)
      .join('\n')
}

function formatDate (d) {
  return '' + d.getFullYear() +
    ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] +
    ' ' + d.getDate()
}

console.log(renderLessonText(lesson))


async function main (args) {
  const allowedBooks = [43]
  const chunkLength = 100
  const minimumDaysSeen = 7
  const maxLearning = 10
  const wordLimit = 200


  const known = await loadKnownWords(minimumDaysSeen)

  const lessonRange = await executeWithPersistentState('lesson', 0, async position => {
    let lessonRange = await buildLessonRange(allowedBooks, position, wordLimit)

    if (lessonRange.start > lessonRange.end) {
      lessonRange = await buildLessonRange(allowedBooks, 0, wordLimit)
    }

    return {
      state: lessonRange.end + 1,
      result: lessonRange,
    }
  })
  const p = await loadPassage(lessonRange)


  const frequencyMap = await loadTokenFrequencyMap()
  const {
    rendered,
    wordCount,
    learningWords,
    seenWords,
    learningFraction,
    revealFraction,
  } = renderLesson(known, chunkLength, maxLearning, frequencyMap, p)

  const reference = calculateReference(p)
  const knownFrequency = calculateKnownFrequency(frequencyMap, known)


  await saveSeenWords(seenWords)


  const format = args[0] === 'html' ? 'html' : 'text'
  if (format === 'text') {
    console.log('GLiB lesson')
    console.log('===========')
    console.log()
    console.log('Highest unknown frequency: >' + knownFrequency + ' times')
    console.log('Word count:', wordCount)
    console.log('Learning:', learningWords.join(', '))
    console.log('Learning ratio:', (learningFraction * 100).toFixed(0) + '%')
    console.log('Reveal ratio:', (revealFraction * 100).toFixed(0) + '%')
    console.log()
    console.log(reference)
    console.log()
    console.log(formatAsText(rendered))
  } else {
    console.log('<html>')
    console.log('<body>')

    console.log('<h1 style="max-width: 1000px; margin: 1em auto; line-height: 1.3">GLiB lesson ' + new Date() + '</h1>')

    console.log('<p style="font-size: 12pt; max-width: 1000px; margin: 1em auto; line-height: 1.3">')
    console.log('Highest unknown frequency: >' + knownFrequency + ' times', '<br>')
    console.log('Word count:', wordCount, '<br>')
    console.log('Learning:', learningWords.join(', '), '<br>')
    console.log('Learning ratio:', (learningFraction * 100).toFixed(0) + '%', '<br>')
    console.log('Reveal ratio:', (revealFraction * 100).toFixed(0) + '%', '<br>')
    console.log('</p>')

    console.log('<h2 style="max-width: 1000px; margin: 1em auto; line-height: 1.3">' + reference + '</h2>')
    console.log(formatAsHtml(rendered))

    console.log('</body>')
    console.log('</html>')
  }
}


async function buildLessonRange (allowedBooks, initialStart, wordLimit) {
  const allowedRanges = await loadIndexByIds('book', allowedBooks.slice().sort())
  const allowedParagraphBlocks = await Promise.all(
    allowedRanges.map(range => loadPassageIndex('paragraph', range)))
  const allowedParagraphs = [].concat(...allowedParagraphBlocks)

  let wordCount = 0
  let start = null
  let end = -Number.MAX_VALUE

  for (const paragraph of allowedParagraphs) {
    if (paragraph.end < initialStart) continue

    if (start === null) {
      start = paragraph.start
      end = paragraph.end
    } else {
      if (end + 1 !== paragraph.start) break
      end = paragraph.end
    }

    wordCount += paragraph.end - paragraph.start + 1
    if (wordCount > wordLimit) break
  }

  return { start, end }
}


function renderLesson (known, chunkLength, maxLearning, frequencyMap, passage) {
  const tokenRendering = {}

  for (const token of passage.tokens) {
    if (isProperNoun(token)) {
      tokenRendering[token.token_id] = 'parallel'
    } else if (known.includes(token.normalised)) {
      tokenRendering[token.token_id] = 'native'
    }
  }


  const allLearningWords = new Set()
  chunkArray(passage.tokens, chunkLength).forEach(chunk => {
    const learningWords = _.chain(chunk)
      .filter(t => !known.includes(t.normalised))
      .map(t => t.normalised)
      .uniq()
      .map(t => [frequencyMap[t], t])
      .sortBy(([fq]) => fq)
      .reverse()
      .take(maxLearning)
      .map(([_, t]) => t)
      .value()

    learningWords.forEach(w => allLearningWords.add(w))

    for (const token of chunk) {
      if (learningWords.includes(token.normalised)) {
        tokenRendering[token.token_id] = 'parallel'
      }
    }
  })

  for (const token of passage.tokens) {
    if (!tokenRendering[token.token_id]) {
      tokenRendering[token.token_id] = 'translation'
    }
  }


  const allWords = new Set()
  const seenWords = new Set()
  for (const token of passage.tokens) {
    const rendering = tokenRendering[token.token_id]
    allWords.add(token.normalised)
    if (rendering === 'native' || rendering === 'parallel') {
      seenWords.add(token.normalised)
    }
  }


  const rendering = renderPassage(passage, {
    divisionIndex: 'paragraph',
    tokenRendering,
  })

  return {
    rendered: rendering,
    wordCount: passage.tokens.length,
    learningWords: [...allLearningWords],
    seenWords: [...seenWords],
    learningFraction: allLearningWords.size / allWords.size,
    revealFraction: seenWords.size / allWords.size,
  }
}


function calculateReference (passage) {
  if (passage.verses.length === 0) return 'N/A'

  const books = {
    40: 'Matthew',
    41: 'Mark',
    42: 'Luke',
    43: 'John',
    44: 'Acts',
    45: 'Romans',
    46: '1 Corinthians',
    47: '2 Corinthians',
    48: 'Galatians',
    49: 'Ephesians',
    50: 'Philippians',
    51: 'Colossians',
    52: '1 Thessalonians',
    53: '2 Thessalonians',
    54: '1 Timothy',
    55: '2 Timothy',
    56: 'Titus',
    57: 'Philemon',
    58: 'Hebrews',
    59: 'James',
    60: '1 Peter',
    61: '2 Peter',
    62: '1 John',
    63: '2 John',
    64: '3 John',
    65: 'Jude',
    66: 'Revelation',
  }

  const startId = passage.verses[0].verse_id.split('-')
  const endId = passage.verses[passage.verses.length - 1].verse_id.split('-')

  if (startId === endId) return formatVerseId(startId)
  else return formatVerseId(startId) + '-' + formatVerseId(endId, startId)


  function formatVerseId (id, diff) {
    const [book, chapter, verse] = id
    const [diffBook, diffChapter] = diff || [null, null, null]

    if (book !== diffBook) {
      return `${books[book]} ${chapter}:${verse}`
    } else if (chapter !== diffChapter) {
      return `${chapter}:${verse}`
    } else {
      return `${verse}`
    }
  }
}

function calculateKnownFrequency (frequencies, knownWords) {
  const unknownFrequencies = { ...frequencies }

  for (const word of knownWords) {
    delete unknownFrequencies[word]
  }

  const maxFrequency = _.reduce(
    unknownFrequencies,
    (acc, v) => Math.max(acc, v),
    0)
  return maxFrequency
}


async function saveSeenWords (words) {
  const emptyState = {
    daysSeen: {},
  }

  await executeWithPersistentState('seen', emptyState, state => {
    const newState = {
      daysSeen: { ...state.daysSeen },
    }

    for (const word of words) {
      const count = newState.daysSeen[word] || 0
      newState.daysSeen[word] = count + 1
    }

    return { state: newState }
  })
}


async function loadKnownWords (minimumDaysSeen) {
  const emptyState = {
    daysSeen: {},
  }

  const state = await loadPersistentState('seen', emptyState)

  return Object.entries(state.daysSeen)
    .filter(([k, v]) => v >= minimumDaysSeen)
    .map(([k]) => k)
}
