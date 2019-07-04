/**
 * Digest -- takes stdin and returns a unique list of words (in original order)
 * that are included in any OpenGNT Greek clauses.
 *
 * Alternatively, the unique filter can be disabled by providing '--no-unique'.
 */

const { normalise, clauses, readStdinWords } = require('./utils')

const availableWordsSet = new Set()
clauses.map(c => c.search)
  .forEach(words => words.forEach(w => availableWordsSet.add(w)))

const makeUnique = process.argv.length < 3 || process.argv[2] !== '--no-unique'

readStdinWords()
  .map(w => normalise(w))
  .filter(w => availableWordsSet.has(w))
  .filter(makeUnique ? uniqueFilter() : () => true)
  .forEach(w => console.log(w))

function uniqueFilter () {
  const set = new Set()
  return string => {
    if (set.has(string)) return false
    set.add(string)
    return true
  }
}
