const keyBy = require('lodash/keyBy')
const mapValues = require('lodash/mapValues')


const VARIA = '\u0300'
const OXIA = '\u0301'
const PERISPOMENI = '\u0342'

const PSILI = '\u0313'
const DASIA = '\u0314'

const BREATHING = [PSILI, DASIA]
const ACCENTS = [VARIA, OXIA, PERISPOMENI]


const PROCLITICS = mapValues(keyBy([
  'ὁ', 'ἡ', 'οἱ', 'αἱ',
  'ἐν', 'εἰς', 'ἐξ', 'ἐκ',
  'εἰ', 'ὡς',
  'οὐ', 'οὐκ', 'οὐχ',
], k => k), () => null)


const ENCLITICS = [
  // personal pronouns
  'μου', 'μοι', 'με',
  'σου', 'σοι', 'σε',

  // indefinite pronouns
  'τὶς', 'τὶ', 'τινός', 'τινί', 'τινά', 'τινές', 'τινάς', 'τινῶν', 'τισίν',
  'τισί',

  // indefinite adverbs
  'πού', 'ποτέ', 'πώ', 'πώς',

  // dissyllabic forms of εἰμί
  'εἰμί', 'εἰσίν', 'εἰσί', 'ἐσμέν', 'ἐστέ', 'ἐστίν', 'ἐστί',

  // dissyllabic forms of φημί
  'φησίν', 'φημί', 'φασίν',

  // certain particles
  'γέ', 'τέ', 'τοι',
]

const ENCLITICS_NORM = keyBy(ENCLITICS, v => stripLastAccent(v))

const ELISION = {
  'ἀλλ’': 'ἀλλά',
  'ἀνθ’': 'ἀντί',
  'ἀπ’': 'ἀπό',
  'ἀφ’': 'ἀπό',
  'γένοιτ’': 'γένοιτο',
  'δ’': 'δέ',
  'δι’': 'διά',
  'δύναιτ’': 'δύναιτο',
  'εἶτ’': 'εἶτα', // @@@
  'ἐπ’': 'ἐπί',
  'ἐφ’': 'ἐπί',
  'ἡγοῖντ’': 'ἡγοῖντο',
  'ἵν’': 'ἵνα',
  'κατ’': 'κατά',
  'καθ’': 'κατά',
  'μηδ’': 'μηδέ',
  'μετ’': 'μετά',
  'μεθ’': 'μετά',
  'ὅτ’': 'ὅτε',
  'οὐδ’': 'οὐδέ',
  'πάνθ’': 'πάντα',
  'πάντ’': 'πάντα',
  'παρ’': 'παρά',
  'ποτ’': 'ποτε',
  'ταῦθ’': 'ταῦτα',
  'τοῦτ’': 'τοῦτο',
  'ὑπ’': 'ὑπό',
  'ὑφ’': 'ὑπό',
}

const MOVABLE = {
  ἐξ: 'ἐκ',

  οὐκ: 'οὐ',
  οὐχ: 'οὐ',
}


function normalise (token) {
  let norm = token

  norm = graveToAcute(norm)

  if (norm in ELISION) norm = ELISION[norm]

  if (norm in MOVABLE) norm = MOVABLE[norm]

  norm = stripLastAccentIfTwo(norm)

  const properNouns = new Set()
  if (!properNouns.has(norm)) {
    if (norm !== norm.toLowerCase()) { norm = norm.toLowerCase() }
  }

  if (countAccents(norm) === 0) {
    if (norm.toLowerCase() in PROCLITICS) {
      norm = norm.toLowerCase()
    } else if (norm.toLowerCase() in ENCLITICS_NORM) {
      norm = ENCLITICS_NORM[norm.toLowerCase()]
    }
  }

  return norm
}


function nfd (s) {
  return s.normalize('NFD')
}


function nfc (s) {
  return s.normalize('NFC')
}


function nfkc (s) {
  return s.normalize('NFKC')
}


function stripAccents (s) {
  return nfc(nfd(s).split('').filter(c => !ACCENTS.includes(c)).join(''))
}


function countAccents (word) {
  return nfd(word).split('').filter(c => ACCENTS.includes(c)).length
}


function stripLastAccent (word) {
  const x = word.split('')
  x.reverse()

  for (let i = 0; i < x.length; i++) {
    const ch = x[i]
    const s = stripAccents(ch)
    if (s !== ch) {
      x[i] = s
      break
    }
  }
  x.reverse()
  return x.join('')
}


function graveToAcute (word) {
  return nfc(nfd(word).split('').map(c => c === VARIA ? OXIA : c).join(''))
}


function stripLastAccentIfTwo (word) {
  if (countAccents(word) === 2) {
    return stripLastAccent(word)
  } else {
    return word
  }
}


function breathingCheck (word) {
  // note: doesn't check for mid-word breathing marks
  const d = nfd(word.toLowerCase())
    .split('')
    .filter(ch => !ACCENTS.includes(ch))

  if ('αεηιοω'.includes(d[0])) {
    if (d.length > 1) {
      if (BREATHING.includes(d[1])) {
        if (d.length > 2 && 'ιυ'.includes(d[2])) {
          return false
        } else {
          return true
        }
      } else if ('ιυ'.includes(d[1])) {
        if (d.length > 2 && BREATHING.includes(d[2])) {
        } else {
          return false
        }
      } else {
        return false
      }
    } else {
      return false
    }
  }
  return true
}

module.exports = {
  normalise,
  nfd, nfc, nfkc,
  breathingCheck,
}
