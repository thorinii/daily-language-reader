/**
 * Clause render -- takes a list of clause IDs (if each line is an array, the
 * first element) on stdin and returns OpenGNT clauses with interlinear and
 * surrounding context.
 *
 * Usage: node clause_render.js <context radius>
 */

const { clauses, readStdin } = require('./utils')

if (process.argv.length !== 3) {
  console.warn('Usage: node clause_render.js <context radius>')
  return
}

const contextRadius = parseInt(process.argv[2])
const clauseIds = readStdin()
  .split('\n')
  .map(text => text.trim())
  .filter(t => t)
  .map(text => JSON.parse(text))
  .map(clause => {
    if (Array.isArray(clause)) return clause[0]
    else if (clause.id) return clause.id
    else return clause
  })

clauseIds
  .map(id => clauses
    .filter(c => c.id >= id - contextRadius && c.id <= id + contextRadius))
  .map(clauses => {
    return {
      text: clauses.map(c => c.text),
      interlinear: clauses.map(c => c.plain)
    }
  })
  .forEach(line => console.log(line))
