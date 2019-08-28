const NEW_WORDS_PER_DAY = 3
const MAX_WORDS_LEARNING = 10
const LEARNING_INTERVAL = 4
const MAX_SIMULTANEOUS_RECALL = 6
const EXAMPLES_PER_WORD = 5
const ISLAND = ['1 John']
const EXTENSIVE_WORD_COUNT = 100


main(process.argv.slice(2)).catch(e => console.warn('error:', e))

async function main (args) {
  // PUMP FEEDER
  // progress to recall
  // add new learn
  // add new achieved verses

  // LOAD LESSON
  // learning
  // recall scheduler
  // load achieved verses and near achieved
  // load reading passage
  // calculate stats
  const lesson = makeLesson()

  // RENDER LESSON
  // load verse text (ESV, greek, mixed)
  // format lesson

  // POST PROCESSING
  // CSS inlining

  console.log(renderLessonText(lesson))
}


function makeLesson () {
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
    learn: [
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
