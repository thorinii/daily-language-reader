const fs = require('fs')

const normalise = s => s.toLowerCase().normalize('NFKD').replace(/[\u0313\u0314\u0345,.’-]/g, '').normalize('NFC')

const clauses = require('./rawtexts/OpenGNT_TranslationByClause.json')

const words = fs.readFileSync('/dev/stdin', 'utf8').split(/\s+/).filter(t => t)

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
