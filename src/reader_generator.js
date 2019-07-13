const fs   = require('fs')
const path = require('path')
const csv  = require('csv-parser')
const {chain}  = require('stream-chain')
const wrap = require('wordwrap')(80)

const rawtextsPath = path.join(__dirname, '../rawtexts')


loadPassage({ paragraph_id: 635, start: 49467, end: 49541 })
  .then(p => {
    const tokenRendering = {}

    for (const token of p.tokens) {
      if (isProperNoun(token)) {
        tokenRendering[token.token_id] = 'parallel'
      }
    }

    return formatPassageText(p, {
      divisionIndex: 'paragraph',
      tokenRendering
    })
  })
  .then(text => console.log(text), e => console.warn('error:', e))


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
      }
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
      }
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


/**
 * Formats a passage as plain text.
 *
 * Options: {
 *   divisionIndex: String  name of the index to use for dividing the text
 * }
 */
function formatPassageText (passage, options) {
  const invisiblePunctation = /[¶]+/g
  const allPunctation = /[-,.;·¶]+/g

  const blocks = divideBlocks(passage, options.divisionIndex || null)
  return blocks
    .map(b => wrap(formatBlock(b, options.tokenRendering || {})))
    .join('\n\n')


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

        const cleanTranslation = t.translation_study === '-' ? null : t.translation_study.replace(allPunctation, '')
        const translation = cleanTranslation || ''
        const parallel = cleanTranslation
          ? `${t.word} (${cleanTranslation})`
          : t.word

        const rendering = tokenRendering[t.token_id] || 'native'
        let text
        if (rendering === 'native') text = native
        else if (rendering === 'translation') text = translation
        else text = parallel

        return (
          t.punctuation_before.replace(invisiblePunctation, '') +
          text +
          t.punctuation_after.replace(invisiblePunctation, '')
        )
      })
      .filter(text => !!text)
      .join(' ')
  }
}


function isProperNoun (token) {
  return /^N-.*-[LPT][GI]?$/.test(token.rmac)
}
