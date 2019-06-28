const fs = require('fs')

const normalise = s => s.toLowerCase().normalize('NFKD').replace(/[\u0313\u0314\u0345,.’-]/g, '').normalize('NFC')

function readStdin () {
  return fs.readFileSync('/dev/stdin', 'utf8')
}

function readStdinWords () {
  return readStdin().split(/\s+/).filter(t => t)
}

const clauses = require('./rawtexts/OpenGNT_TranslationByClause.json')

module.exports = {
  clauses,

  normalise,
  readStdin,
  readStdinWords,
}
