const fs = require('fs')
const path = require('path')
const {chain}  = require('stream-chain')
const {parser} = require('stream-json')
const {streamArray} = require('stream-json/streamers/StreamArray')
const csvWriteStream = require('csv-write-stream')


const rawtextsPath = path.join(__dirname, '../rawtexts')

const tokenStream = chain([
  csvWriteStream(),
  fs.createWriteStream(path.join(rawtextsPath, 'ognt_33_tokens.csv')),
])

const indexBookStream = chain([
  makeRangeIndexer('book_id'),
  csvWriteStream(),
  fs.createWriteStream(path.join(rawtextsPath, 'ognt_33_index_books.csv')),
])
const indexChapterStream = chain([
  makeRangeIndexer('chapter_id'),
  csvWriteStream(),
  fs.createWriteStream(path.join(rawtextsPath, 'ognt_33_index_chapters.csv')),
])
const indexVerseStream = chain([
  makeRangeIndexer('verse_id'),
  csvWriteStream(),
  fs.createWriteStream(path.join(rawtextsPath, 'ognt_33_index_verses.csv')),
])
const indexParagraphStream = chain([
  makeRangeIndexer('paragraph_id'),
  csvWriteStream(),
  fs.createWriteStream(path.join(rawtextsPath, 'ognt_33_index_paragraphs.csv')),
])
const indexSentenceStream = chain([
  makeRangeIndexer('sentence_id'),
  csvWriteStream(),
  fs.createWriteStream(path.join(rawtextsPath, 'ognt_33_index_sentences.csv')),
])


chain([
  fs.createReadStream(path.join(rawtextsPath, 'OpenGNT_version3_3.json')),
  parser(),
  streamArray(),
  row => {
    const index = row.key
    row = row.value
    return {
      token_id: index + 1,
      book: row.Book,
      chapter: row.Chapter,
      verse: row.Verse,
      clause_id: row.LevinsohnClauseID,
      word: row.OGNTa,
      lexeme: row.lexeme,
      rmac: row.rmac,
      translation_interlinear: row.IT,
      translation_literal: row.LT,
      translation_study: row.ST,
      translation_index: row.STsortI,
      punctuation_before: row.PMpWord.replace(/(^<pm>|<\/pm>$)/g, '').split('</pm><pm>').filter(p => p),
      punctuation_after: row.PMfWord.replace(/(^<pm>|<\/pm>$)/g, '').split('</pm><pm>').filter(p => p),
    }
  },
])
  .on('data', (() => {
    let counter = 0

    let book = null
    let chapter = null
    let verse = null
    let paragraphCounter = 1
    let sentenceCounter = 1
    let flushTextCounters = false

    return row => {
      tokenStream.write({
        token_id: row.token_id,
        word: row.word,
        lexeme: row.lexeme,
        rmac: row.rmac,
        translation_interlinear: row.translation_interlinear,
        translation_literal: row.translation_literal,
        translation_study: row.translation_study,
        translation_index: row.translation_index,
        punctuation_before: row.punctuation_before.join(''),
        punctuation_after: row.punctuation_after.join(''),
      })

      if (book !== row.book) {
        book = row.book
        chapter = -1
        flushTextCounters = true

        indexBookStream.write({
          type: 'start',
          id: row.book,
          pointer: row.token_id,
        })
      }

      if (chapter !== row.chapter) {
        chapter = row.chapter
        verse = -1

        indexChapterStream.write({
          type: 'start',
          id: row.book + '-' + row.chapter,
          pointer: row.token_id,
        })
      }

      if (verse !== row.verse) {
        verse = row.verse

        indexVerseStream.write({
          type: 'start',
          id: row.book + '-' + row.chapter + '-' + row.verse,
          pointer: row.token_id,
        })
      }

      if (row.punctuation_after.includes('¶') || flushTextCounters) {
        indexParagraphStream.write({
          type: 'start',
          id: paragraphCounter,
          pointer: row.token_id,
        })
        paragraphCounter++
      }

      if (row.punctuation_after.includes('.') || flushTextCounters) {
        indexSentenceStream.write({
          type: 'start',
          id: sentenceCounter,
          pointer: row.token_id,
        })
        sentenceCounter++
      }


      flushTextCounters = false


      if (counter % 1000 === 0) console.log('processed', counter, 'words')
      counter++
    }
  })())
  .on('error', e => {
    console.warn('Error:', e)
  })
  .on('end', () => {
    tokenStream.destroy()

    indexBookStream.write({ type: 'end' })
    indexChapterStream.write({ type: 'end' })
    indexVerseStream.write({ type: 'end' })
    indexParagraphStream.write({ type: 'end' })
    indexSentenceStream.write({ type: 'end' })

    indexBookStream.destroy()
    indexChapterStream.destroy()
    indexVerseStream.destroy()
    indexParagraphStream.destroy()
    indexSentenceStream.destroy()
  })


function makeRangeIndexer (key) {
  let id = null
  let start = null
  let last = null

  return event => {
    if (event.pointer) last = event.pointer

    const s = start

    if (start !== null && start !== last) {
      if (event.type === 'start') {
        start = last
        id = event.id
      } else {
        start = null
      }

      return {
        [key]: id,
        start: s,
        end: last - 1,
      }
    } else if (event.type === 'start') {
      start = last
      id = event.id
      return null
    }
  }
}
