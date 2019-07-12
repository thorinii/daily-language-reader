/**
 * Windowed clause search -- takes a list of words on stdin and returns the
 * least costly OpenGNT clause sequences relative to them.
 */

const shuffle = require('shuffle-array')
const { clauses, readStdinWords } = require('./utils')

if (process.argv.length !== 6) {
  console.warn('Usage: node windowed_clause_search.js <window size> <min cost> <count> <format>')
  return
}

const windowSize = parseInt(process.argv[2])
const minCost = parseInt(process.argv[3])
const count = parseInt(process.argv[4])
const minKnownFraction = 0.6
const inHtml = process.argv[5] === 'html'
const words = new Set(readStdinWords())


const sequences = []


let previous = []
for (const clause of clauses) {
  if (previous.length === windowSize) previous.shift()
  previous.push(clause)
  if (previous.length < windowSize) continue

  const allWords = [...new Set([].concat(...previous.map(c => c.search)))]
  const cost = allWords.filter(w => !words.has(w)).length
  const knownFraction = (allWords.length - cost) / allWords.length

  if (cost >= minCost && knownFraction > minKnownFraction) {
    sequences.push({
      wordCount: allWords.length,
      cost,
      clauses: previous.slice()
    })
  }
}


if (inHtml) {
  console.log('<html>')
  console.log('<body>')
  console.log('<h1>GLiB lesson' + new Date().toISOString() + '</h1>')
  console.log('<p>' + sequences.length + ' sequences found total; showing at most ' + count + '</p>')
} else {
  console.log(sequences.length, 'sequences')
}


shuffle(sequences)
sequences
  .sort((a, b) => a.cost < b.cost ? -1 : 1)
  .slice(0, count)
  .forEach(sequence => {
    const text = sequence.clauses.map(c => c.text).join(' | ')
    const plain = sequence.clauses.map(c => c.plain).join(' ')

    // TODO: passage location in verse coordinates

    if (inHtml) {
      console.log(`<h2>Unknown location: cost ${sequence.cost} / ${sequence.wordCount}</h2>`)
      console.log('<p>' + text + '</p>')
      console.log('<p>' + plain + '</p>')
    } else {
      console.log(`=========== cost ${sequence.cost} / ${sequence.wordCount}`)
      console.log('  ' + text)
      console.log()
      console.log('  ' + plain)
      console.log()
    }
  })


if (inHtml) {
  console.log(`<style>
html {
  font-size: 16pt;
  max-width: initial;
}
body {
  margin: auto;
}
* {
  max-width: 70ch;
}
</style>`)
  console.log('</body>')
  console.log('</html>')
}
