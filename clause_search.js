const { normalise, clauses, readStdinWords } = require('./utils')

const words = readStdinWords()

// TODO: return clause IDs as well
console.log(words
  .map(t => normalise(t)).filter(t => t)
  .map(w => [w, clauses
    .filter(c => c.search.includes(w))
    .sort(() => Math.random() < 0.5 ? 1 : -1)
    .sort((a, b) => a.search.length < b.search.length ? -1 : 1)
    .slice(0, 5)
    .map(c => c.text + '  |  ' + c.plain)])
  .filter(wc => wc[1].length > 0))
