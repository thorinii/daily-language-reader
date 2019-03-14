const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

main().then(null, e => console.error('Crash', e))


async function main () {
  // const filename = process.argv[2] || '85-3Jn.txt'
  // console.log(await promisify(fs.readdir)(path.join(__dirname, 'rawtexts')))

  // const phrases = await loadBookPhrases(filename)

  const bookFiles = (await promisify(fs.readdir)(path.join(__dirname, 'rawtexts')))
    .filter(f => /^[0-9]+/.test(f) && !f.endsWith('-APP.txt'))

  const bookPhrasePs = bookFiles.map(bf => loadBookPhrases(bf))

  const phrases = [].concat(...(await Promise.all(bookPhrasePs)))

  const freq1Map = new Map()
  phrases.forEach(phrase => {
    phrase.forEach(word => {
      const key = word.word
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
        const key = prev.word + ' ' + word.word
        freq2Map.set(key, freq2Map.has(key) ? freq2Map.get(key) + 1 : 1)
      }
      prev = word
    })
  })
  const freq2 = [...freq2Map.entries()].sort((a, b) => a[1] > b[1] ? -1 : 1).slice(0, 30)
  console.log(freq2)
}


async function loadBookPhrases (filename) {
  const filePath = path.join(__dirname, 'rawtexts', filename)
  const contents = (await promisify(fs.readFile)(filePath, 'utf8'))

  const lines = contents.split('\n').map(l => l.trim()).filter(l => !!l)
  const bookName = lines[0]

  const rawVerses = lines.slice(1)

  const verses = rawVerses.map(line => {
    const split = line.split('\t')
    const reference = split[0]
    const text = split[1]
    return [reference, text]
  })

  const wordsAndPunctuation = [].concat(...verses.map(verse => {
    const split = verse[1].replace(/⸀/g, '').replace(/·/g, ' ·').replace(/\./g, ' .').replace(/,/g, ' ,').split(' ')
    return split.map((word, idx) => {
      if (word === '.' || word === ',' || word === '·') return { punctuator: word }
      return { word, reference: verse[0], verseIndex: idx }
    })
  }))

  const phrases = []
  let tmp = []
  wordsAndPunctuation.forEach(w => {
    if (w.punctuator) {
      if (tmp.length > 0) phrases.push(tmp)
      tmp = []
    } else {
      w.phraseIndex = tmp.length
      tmp.push(w)
    }
  })

  return phrases
}
