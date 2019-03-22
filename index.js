const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

main().then(null, e => console.error('Crash', e))


async function main () {
  const bookFiles = (await promisify(fs.readdir)(path.join(__dirname, 'rawtexts')))
    .filter(f => /^[0-9]+/.test(f) && f.endsWith('-morphgnt.txt'))

  const bookPhrasePs = bookFiles.map(bf => loadBookPhrases(bf))

  const phrases = [].concat(...(await Promise.all(bookPhrasePs)))

  const freq1Map = new Map()
  phrases.forEach(phrase => {
    phrase.forEach(word => {
      const key = word.lemma
      freq1Map.set(key, freq1Map.has(key) ? freq1Map.get(key) + 1 : 1)
    })
  })
  const freq1 = [...freq1Map.entries()].sort((a, b) => a[1] > b[1] ? -1 : 1).slice(0, 30)
  console.log(freq1)

  const freq2Map = new Map()
  phrases.forEach(phrase => {
    let prev = null
    phrase.forEach(word => {
      if (prev !== null) {
        const key = prev.lemma + ' ' + word.lemma
        freq2Map.set(key, freq2Map.has(key) ? freq2Map.get(key) + 1 : 1)
      }
      prev = word
    })
  })
  const freq2 = [...freq2Map.entries()].sort((a, b) => a[1] > b[1] ? -1 : 1).slice(0, 30)
  console.log(freq2)

  const freq3Map = new Map()
  const freq3RawMap = new Map()
  phrases.forEach(phrase => {
    let prev1 = null
    let prev2 = null
    phrase.forEach(word => {
      if (prev1 !== null) {
        const key = prev1.lemma + ' ' + prev2.lemma + ' ' + word.lemma
        freq3Map.set(key, freq3Map.has(key) ? freq3Map.get(key) + 1 : 1)

        let arr;
        if (!freq3RawMap.has(key)) freq3RawMap.set(key, arr = [])
        else arr = freq3RawMap.get(key)
        arr.push(prev1.text + ' ' + prev2.text + ' ' + word.text)
      }
      prev1 = prev2
      prev2 = word
    })
  })
  const freq3 = [...freq3Map.entries()].sort((a, b) => a[1] > b[1] ? -1 : 1).slice(0, 30)
  console.log(freq3.map(fq => ({ key: fq[0], fq: fq[1], examples: freq3RawMap.get(fq[0]).slice(0, 4) })))
}


async function loadBookPhrases (filename) {
  const filePath = path.join(__dirname, 'rawtexts', filename)
  const contents = (await promisify(fs.readFile)(filePath, 'utf8'))

  const lines = contents.split('\n').map(l => l.trim()).filter(l => !!l)
  const rawVerses = lines

  const words = rawVerses.map(line => {
    const split = line.split(' ')
    const [reference, partOfSpeech, parsing, text, word, normalised, lemma] = split
    return { reference, text, word, lemma }
  })

  const phrases = []
  let tmp = []
  words.forEach(w => {
    const isPunctuated = w.text !== w.word
    const isStartPunctuated = isPunctuated && w.text.endsWith(w.word)
    const isEndPunctuated = isPunctuated && w.text.startsWith(w.word)

    if (isStartPunctuated) {
      if (tmp.length > 0) phrases.push(tmp)
      tmp = []
    }

    w.phraseIndex = tmp.length
    tmp.push(w)

    if (isEndPunctuated || (!isStartPunctuated && isPunctuated)) {
      if (tmp.length > 0) phrases.push(tmp)
      tmp = []
    }
  })
  // console.log(phrases)

  if (tmp.length > 0) phrases.push(tmp)

  return phrases
}
