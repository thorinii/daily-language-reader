const fs = require('fs')

function normalise (string) {
  return string
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0313\u0314\u0345,.’-]/g, '')
    .normalize('NFC')
}

function readStdin () {
  return fs.readFileSync('/dev/stdin', 'utf8')
}

function readStdinWords () {
  return readStdin().split(/\s+/).filter(t => t)
}

const clauses = require('../rawtexts/OpenGNT_TranslationByClause.json')
  .map((clause, idx) => {
    clause.id = idx
    return clause
  })

module.exports = {
  clauses,

  normalise,
  readStdin,
  readStdinWords,
}
