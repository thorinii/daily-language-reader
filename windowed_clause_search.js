/**
 * Windowed clause search -- takes a list of words on stdin and returns the
 * least costly OpenGNT clause sequences relative to them.
 *
 * Usage: node windowed_clause_search.js <window size> <min cost> <count>
 */

const shuffle = require('shuffle-array')
const { clauses, readStdinWords } = require('./utils')

if (process.argv.length !== 5) {
  console.warn('Usage: node windowed_clause_search.js <window size> <min cost> <count>')
  return
}

const windowSize = parseInt(process.argv[2])
const minCost = parseInt(process.argv[3])
const count = parseInt(process.argv[4])
const words = new Set(readStdinWords())


const sequences = []


let previous = []
for (const clause of clauses) {
  if (previous.length === windowSize) previous.shift()
  previous.push(clause)
  if (previous.length < windowSize) continue

  const allWords = [...new Set([].concat(...previous.map(c => c.search)))]
  const cost = allWords.filter(w => !words.has(w)).length

  if (cost >= minCost) {
    sequences.push({
      cost,
      clauses: previous.slice()
    })
  }
}


console.log(sequences.length, 'sequences')
shuffle(sequences)
sequences
  .sort((a, b) => a.cost < b.cost ? -1 : 1)
  .slice(0, count)
  .forEach(sequence => {
    console.log(`== ${sequence.cost} ========`)
    console.log(sequence.clauses.map(c => c.text).join(' | '))
    console.log(sequence.clauses.map(c => c.plain).join(' '))
  })
