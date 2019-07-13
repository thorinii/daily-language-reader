const chunkArray = require('lodash/chunk')
const _ = require('lodash')

const {
  loadPassage,
  loadPassageIndex,
  loadIndexByIds,
  loadTokenFrequencyMap,
  isProperNoun,
} = require('./ognt_dataset.js')
const { renderPassage, formatAsText, formatAsHtml } = require('./renderer.js')


main().catch(e => console.warn('error:', e))

async function main () {
  const frequencyMap = await loadTokenFrequencyMap()

  const known = []
  const chunkLength = 100
  const maxLearning = 10

  const lessonRange = await buildLessonRange([43], 0, 200)
  const p = await loadPassage(lessonRange)


  const {
    rendered,
    wordCount,
    learningWords,
    learningFraction,
    revealFraction,
  } = renderLesson(known, chunkLength, maxLearning, frequencyMap, p)


  console.log('Word count:', wordCount)
  console.log('Learning:', learningWords.join(', '))
  console.log('Learning ratio:', (learningFraction * 100).toFixed(0) + '%')
  console.log('Reveal ratio:', (revealFraction * 100).toFixed(0) + '%')
  console.log()
  console.log(formatAsText(rendered))
  console.log()
  console.log(formatAsHtml(rendered))
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
