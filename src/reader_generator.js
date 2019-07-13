const chunkArray = require('lodash/chunk')
const _ = require('lodash')

const { loadPassage, loadTokenFrequencyMap, isProperNoun } = require('./ognt_dataset.js')
const { renderPassage, formatAsText, formatAsHtml } = require('./renderer.js')


main().catch(e => console.warn('error:', e))

async function main () {
  const frequencyMap = await loadTokenFrequencyMap()

  const known = []
  const chunkLength = 50
  const maxLearning = 5

  const p = await loadPassage({ paragraph_id: 635, start: 49467, end: 49541 })


  const {
    rendered,
    learningWords,
    learningFraction,
    revealFraction,
  } = renderLesson(known, chunkLength, maxLearning, frequencyMap, p)


  console.log('Learning:', learningWords.join(', '))
  console.log('Learning ratio:', (learningFraction * 100).toFixed(0) + '%')
  console.log('Reveal ratio:', (revealFraction * 100).toFixed(0) + '%')
  console.log()
  console.log(formatAsText(rendered))
  console.log()
  console.log(formatAsHtml(rendered))
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
    learningWords: [...allLearningWords],
    learningFraction: allLearningWords.size / allWords.size,
    revealFraction: seenWords.size / allWords.size,
  }
}
