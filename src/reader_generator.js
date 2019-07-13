const fs = require('fs')
const path = require('path')
const csv = require('csv-parser')
const { chain } = require('stream-chain')
const wrap = require('wordwrap')(80)
const chunkArray = require('lodash/chunk')
const _ = require('lodash')

const rawtextsPath = path.join(__dirname, '../rawtexts')

main().catch(e => console.warn('error:', e))

async function main () {
  const frequencyMap = await loadTokenFrequencyMap()

  const known = []
  const chunkLength = 50
  const maxLearning = 5

  const p = await loadPassage({ paragraph_id: 635, start: 49467, end: 49541 })


  const tokenRendering = {}

  for (const token of p.tokens) {
    if (isProperNoun(token)) {
      tokenRendering[token.token_id] = 'parallel'
    } else if (known.includes(token.normalised)) {
      tokenRendering[token.token_id] = 'native'
    }
  }


  const allLearningWords = new Set()
  chunkArray(p.tokens, chunkLength).forEach(chunk => {
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

  for (const token of p.tokens) {
    if (!tokenRendering[token.token_id]) {
      tokenRendering[token.token_id] = 'translation'
    }
  }


  const allWords = new Set()
  const seenWords = new Set()
  for (const token of p.tokens) {
    const rendering = tokenRendering[token.token_id]
    allWords.add(token.normalised)
    if (rendering === 'native' || rendering === 'parallel') {
      seenWords.add(token.normalised)
    }
  }


  const rendering = renderPassage(p, {
    divisionIndex: 'paragraph',
    tokenRendering,
  })

  console.log('Learning:', [...allLearningWords].join(', '))
  console.log('Learning ratio:', (allLearningWords.size / allWords.size * 100).toFixed(0) + '%')
  console.log('Reveal ratio:', (seenWords.size / allWords.size * 100).toFixed(0) + '%')
  console.log()
  console.log(formatAsText(rendering))
  console.log()
  console.log(formatAsHtml(rendering))
}


async function loadPassage (range) {
  const [
    tokens,
    books, chapters, verses,
    paragraphs, sentences,
  ] = await Promise.all([
    loadPassageTokens(range),
    loadPassageIndex('book', range),
    loadPassageIndex('chapter', range),
    loadPassageIndex('verse', range),
    loadPassageIndex('paragraph', range),
    loadPassageIndex('sentence', range),
  ])

  return {
    tokens,
    books, chapters, verses,
    paragraphs, sentences,
  }
}


function loadPassageTokens (range) {
  const ids = new Set()
  for (let i = range.start; i <= range.end; i++) {
    ids.add(i)
  }

  return new Promise((resolve, reject) => {
    const tokens = []

    chain([
      fs.createReadStream(path.join(rawtextsPath, 'ognt_33_tokens.csv')),
      csv(),
      row => {
        Object.keys(row).forEach(k => {
          const v = row[k]
          if (v && !isNaN(v)) row[k] = parseInt(v)
        })
        return row
      },
    ])
      .on('data', row => {
        if (ids.has(row.token_id)) tokens.push(row)
      })
      .on('error', e => reject(e))
      .on('end', () => resolve(tokens))
  })
}

function loadPassageIndex (indexName, range) {
  return new Promise((resolve, reject) => {
    const slices = []

    chain([
      fs.createReadStream(path.join(rawtextsPath, 'ognt_33_index_' + indexName + '.csv')),
      csv(),
      row => {
        Object.keys(row).forEach(k => {
          const v = row[k]
          if (v && !isNaN(v)) row[k] = parseInt(v)
        })
        return row
      },
    ])
      .on('data', row => {
        if (row.start <= range.end && row.end >= range.start) {
          slices.push(row)
        }
      })
      .on('error', e => reject(e))
      .on('end', () => resolve(slices))
  })
}


function loadTokenFrequencyMap () {
  return new Promise((resolve, reject) => {
    const counts = {}

    chain([
      fs.createReadStream(path.join(rawtextsPath, 'ognt_33_tokens.csv')),
      csv(),
      row => {
        Object.keys(row).forEach(k => {
          const v = row[k]
          if (v && !isNaN(v)) row[k] = parseInt(v)
        })
        return row
      },
    ])
      .on('data', row => {
        if (counts[row.normalised]) {
          counts[row.normalised] = counts[row.normalised] + 1
        } else {
          counts[row.normalised] = 1
        }
      })
      .on('error', e => reject(e))
      .on('end', () => resolve(counts))
  })
}


/**
 * Renders a passage into blocks of rendered words.
 *
 * Options: {
 *   divisionIndex: String  name of the index to use for dividing the text
 *   tokenRendering: ID => String  type of rendering for each token
 * }
 */
function renderPassage (passage, options) {
  const invisiblePunctation = /[ ¶]+/g
  const allPunctation = /[“”:?,.;·¶-]+/g

  const blocks = divideBlocks(passage, options.divisionIndex || null)
  return blocks
    .map(b => formatBlock(b, options.tokenRendering || {}))


  function divideBlocks (passage, divisionIndex) {
    if (divisionIndex === null) return [passage.tokens]
    const index = passage[divisionIndex + 's']

    return index.map(slice => {
      return passage.tokens.filter(t =>
        t.token_id >= slice.start && t.token_id <= slice.end)
    })
  }


  function formatBlock (tokens, tokenRendering) {
    return tokens
      .map(t => {
        const native = t.word

        const cleanTranslation = t.translation_study === '-' ? null : t.translation_study.replace(allPunctation, '').trim()
        const translation = cleanTranslation || ''

        const parallel = cleanTranslation
          ? [t.word, cleanTranslation]
          : [t.word]

        const rendering = tokenRendering[t.token_id] || 'native'
        let text
        if (rendering === 'native') text = [native]
        else if (rendering === 'translation') text = [translation]
        else text = parallel

        return [
          t.punctuation_before.replace(invisiblePunctation, ''),
          text,
          t.punctuation_after.replace(invisiblePunctation, ''),
        ]
      })
  }
}

function formatAsText (rendering) {
  return rendering
    .map(block => wrap(formatBlock(block)))
    .join('\n\n')


  function formatBlock (stream) {
    return stream
      .map(word => {
        return word
          .map(piece => {
            if (Array.isArray(piece)) {
              return piece.map((s, idx) => {
                if (idx !== 0) return '(' + s + ')'
                else return s
              }).join(' ')
            } else {
              return piece
            }
          })
          .join('')
      })
      .filter(text => !!text)
      .join(' ')
  }
}

function formatAsHtml (rendering) {
  return rendering
    .map(block => (
      '<p style="font-size: 16pt; max-width: 50em; margin: auto; line-height: 1.6">' +
      wrap(formatBlock(block)) +
      '</p>'))
    .join('\n')


  function formatBlock (stream) {
    return stream
      .map(word => {
        return word
          .map(piece => {
            if (Array.isArray(piece) && piece.length > 1) {
              return (
                '<span style="display: inline-block; text-align: center; padding-bottom: 12px">' +
                piece.filter(p => p).map((p, idx) => idx > 0 ? `<span style="color: grey; line-height: 1">${p}</span>` : p).join('<br>') +
                '</span>')
            } else if (piece !== '') {
              return '<span style="vertical-align: top">' + piece + '</span>'
            }
          })
          .join('')
      })
      .filter(text => !!text)
      .join(' ')
  }
}


function isProperNoun (token) {
  return /^N-.*-[LPT][GI]?$/.test(token.rmac)
}
