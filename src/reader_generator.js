const fs   = require('fs')
const path = require('path')
const csv  = require('csv-parser')
const {chain}  = require('stream-chain')
const wrap = require('wordwrap')(80)

const rawtextsPath = path.join(__dirname, '../rawtexts')


loadPassage({ paragraph_id: 635, start: 49467, end: 49541 })
  .then(p => formatPassageText(p, { divisionIndex: 'paragraph' }))
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

  const blocks = divideBlocks(passage, options.divisionIndex || null)
  return blocks.map(b => wrap(formatBlock(b))).join('\n\n')


  function divideBlocks (passage, divisionIndex) {
    if (divisionIndex === null) return [passage.tokens]
    const index = passage[divisionIndex + 's']

    return index.map(slice => {
      return passage.tokens.filter(t =>
        t.token_id >= slice.start && t.token_id <= slice.end)
    })
  }


  function formatBlock (tokens) {
    return tokens.map(t => {
      return (
        t.punctuation_before.replace(invisiblePunctation, '') +
        t.word +
        t.punctuation_after.replace(invisiblePunctation, '')
      )
    }).join(' ')
  }
}
