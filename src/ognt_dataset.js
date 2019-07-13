const fs = require('fs')
const path = require('path')
const csv = require('csv-parser')
const { chain } = require('stream-chain')

const rawtextsPath = path.join(__dirname, '../rawtexts')


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

function loadIndexByIds (indexName, ids) {
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
        if (ids.includes(row[indexName + '_id'])) slices.push(row)
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


function isProperNoun (token) {
  return /^N-.*-[LPT][GI]?$/.test(token.rmac)
}


module.exports = {
  loadPassage, loadPassageIndex,
  loadIndexByIds,
  loadTokenFrequencyMap,
  isProperNoun,
}
