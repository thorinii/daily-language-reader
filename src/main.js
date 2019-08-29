const NEW_WORDS_PER_DAY = 3
const MAX_WORDS_LEARNING = 10
const LEARNING_INTERVAL = 4
const MAX_SIMULTANEOUS_RECALL = 6
const EXAMPLES_PER_WORD = 5
const ISLAND = ['1 John']
const EXTENSIVE_WORD_COUNT = 100


const zipWith = require('lodash/zipWith')

const {
  loadPersistentState,
  executeWithPersistentState,
} = require('./persistence.js')

const {
  loadPassage,
  loadPassageIndex,
  loadIndexByIds,
  loadTokenFrequencyMap,
  isProperNoun,
} = require('./ognt_dataset.js')


main(process.argv.slice(2)).catch(e => console.warn('error:', e))

async function main (args) {
  await pumpFeeder()

  const lesson = await loadLesson()

  // RENDER LESSON
  // load verse text (ESV, greek, mixed)
  // format lesson
  const text = renderLessonText(lesson)

  // POST PROCESSING
  // CSS inlining

  console.log(text)
}


async function pumpFeeder () {
  // progress to recall
  // add new learn
  // add new achieved verses
}


async function loadLesson () {
  // learning
  // recall scheduler
  // load achieved verses and near achieved
  // load reading passage
  // calculate stats

  // STATE
  // learning: [{
  //   word: 'tau'
  //   definition: ''
  //   translations: []
  //   examples: ['390423']
  //   timesSeen: 2
  // }]
  //
  // recall: [{
  //   word: 'tau'
  //   examples: [...]
  //   timesRecalled
  //   nextRecall
  // }]
  //
  // knownWords: ['tau', ...]
  //
  // achieved: [{
  //   reference: '...'
  //   achievedOn
  // }]
  //
  // extensiveReading: next token ID

  const learningWords = [
    {
      word: 'τρεῖς',
      definition: 'three, etc etc',
      translations: ['three'],
      examples: [
        '40012040',
        '42002046',
        '59005017',
      ],
    },
  ]

  const knownWords = ['τρεῖς']


  for (const learningWord of learningWords) {
    // TODO: only take a selection of examples
    const indexes = await loadIndexByIds('verse', learningWord.examples.map(e => {
      return e.slice(0, 2) + '-' + parseInt(e.slice(2, 5)) + '-' + parseInt(e.slice(5))
    }))

    const verses = await Promise.all(indexes.map(i => loadPassage(i)))
    const english = learningWord.examples

    const formatted = zipWith(verses, english).map(([verse, english]) => {
      return {
        reference: calculateReference(verse),
        text: verse.tokens.map(v => v.word).join(' '),
        mixed: verse.tokens.map(v => knownWords.includes(v.word) ? v.word : v.translation_study).join(' '),
        translation: english,
      }
    })

    learningWord.examples = formatted
  }

  return {
    date: new Date(),
    recall: [
      {
        word: 'tau',
        examples: [
          {
            reference: 'Matthew 13:28',
            text: '',
            mixed: '',
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
            mixed: '',
            translation: '',
          },
        ],
      },
    ],
    learn: learningWords,
    achievedVerses: [
      {
        fraction: 1,
        reference: '1 Timothy 2:8',
        text: '',
        mixed: '',
      },
      {
        fraction: 0.92,
        reference: 'Philemon 1:3',
        text: '',
        mixed: '',
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
    attributions: [
      'ESV',
      'OpenGNT',
    ],
  }
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

  text += '\n\n'

  text += '## Attributions\n'
  text += lesson.attributions.join('\n\n')

  return text.trim()
}

function renderVerse (verse) {
  return verse.reference + '\n' +
    [verse.text, verse.mixed, verse.translation]
      .filter(t => t)
      .join('\n')
}

function formatDate (d) {
  return '' + d.getFullYear() +
    ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] +
    ' ' + d.getDate()
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

  if (startId.join('') === endId.join('')) return formatVerseId(startId)
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
