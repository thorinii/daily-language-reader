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


main(process.argv.slice(2)).catch(e => console.warn('error:', e))


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


  await saveSeenWords(seenWords)


  // TODO: display reference
  // TODO: fix parseInt in tokens

  const format = args[0] === 'html' ? 'html' : 'text'
  if (format === 'text') {
    console.log('GLiB lesson')
    console.log('===========')
    console.log()
    console.log('Word count:', wordCount)
    console.log('Learning:', learningWords.join(', '))
    console.log('Learning ratio:', (learningFraction * 100).toFixed(0) + '%')
    console.log('Reveal ratio:', (revealFraction * 100).toFixed(0) + '%')
    console.log()
    console.log(formatAsText(rendered))
  } else {
    console.log('<html>')
    console.log('<body>')

    console.log('<h1 style="max-width: 1000px; margin: 1em auto; line-height: 1.3">GLiB lesson ' + new Date() + '</h1>')

    console.log('<p style="font-size: 12pt; max-width: 1000px; margin: 1em auto; line-height: 1.3">')
    console.log('Word count:', wordCount, '<br>')
    console.log('Learning:', learningWords.join(', '), '<br>')
    console.log('Learning ratio:', (learningFraction * 100).toFixed(0) + '%', '<br>')
    console.log('Reveal ratio:', (revealFraction * 100).toFixed(0) + '%', '<br>')
    console.log('</p>')

    console.log('<h2 style="max-width: 1000px; margin: 1em auto; line-height: 1.3">Passage</h2>')
    console.log(formatAsHtml(rendered))

    console.log('</body>')
    console.log('</html>')
  }
}


async function buildLessonRange (allowedBooks, initialStart, wordLimit) {
  const allowedRanges = await loadIndexByIds('book', allowedBooks)
  const allowedParagraphBlocks = await Promise.all(
    allowedRanges.map(range => loadPassageIndex('paragraph', range)))
  const allowedParagraphs = [].concat(...allowedParagraphBlocks)

  let wordCount = 0
  let start = Number.MAX_VALUE
  let end = -Number.MAX_VALUE

  for (const paragraph of allowedParagraphs) {
    if (paragraph.end < initialStart) continue

    start = Math.min(start, paragraph.start)
    end = Math.max(end, paragraph.end)
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
