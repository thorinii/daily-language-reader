/**
 * Clause search -- takes a list of words on stdin and returns OpenGNT
 * clauses that contain one or more of them.
 *
 * Usage: node clause_search.js <number of clauses per word>
 */

const { clauses, readStdinWords } = require('./utils')

if (process.argv.length !== 3) {
  console.warn('Usage: node clause_search.js <number of clauses per word>')
  return
}

const clausesPerWord = parseInt(process.argv[2])
const words = readStdinWords()

words
  .map(w => clauses
    .filter(c => c.search.includes(w))
    .sort(() => Math.random() < 0.5 ? 1 : -1)
    .slice(0, clausesPerWord)
    .map(c => [c.id, w, c.text, c.plain]))
  .filter(wc => wc.length > 0)
  .forEach(wc => wc.forEach(clause => console.log(clause)))
