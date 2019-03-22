const fs = require('fs')
const path = require('path')

const csv = require('csv-parser')
const Database = require('better-sqlite3')

async function main () {
  const db = new Database('database.sqlite3')
  installDb(db)
  await extractTextIntoDb(db)
  addIndexes(db)

  console.log(db.prepare('select text_lemma, COUNT(*), MAX(verse_number) from text_words GROUP BY text_lemma HAVING COUNT(*) > 2 ORDER BY COUNT(*) DESC;').all())

  db.close()
}

function installDb (db) {
  db.exec(`
    CREATE TABLE text_words (
      id SERIAL,

      text TEXT NOT NULL,
      text_unaccented TEXT NOT NULL,
      text_lemma TEXT NOT NULL,

      gloss_word TEXT NOT NULL,
      gloss_interlinear TEXT NOT NULL,

      book_id INTEGER NOT NULL,
      chapter_number INTEGER NOT NULL,
      verse_number INTEGER NOT NULL,
      paragraph_id INTEGER NOT NULL,
      sentence_id INTEGER NOT NULL,
      clause_id INTEGER NOT NULL
    );

    CREATE TABLE text_clauses (
      id SERIAL,

      text TEXT NOT NULL,
      text_lemma TEXT NOT NULL,

      gloss_word TEXT NOT NULL,
      gloss_interlinear TEXT NOT NULL
    );
  `)
}

function addIndexes (db) {
  db.exec(`CREATE INDEX text_words_id ON text_words (id);`)

  db.exec(`CREATE INDEX text_words_text ON text_words (text);`)
  db.exec(`CREATE INDEX text_words_text_unaccented ON text_words (text_unaccented);`)
  db.exec(`CREATE INDEX text_words_text_lemma ON text_words (text_lemma);`)

  db.exec(`CREATE INDEX text_words_book_id ON text_words (book_id);`)
  db.exec(`CREATE INDEX text_words_chapter_number ON text_words (chapter_number);`)
  db.exec(`CREATE INDEX text_words_verse_number ON text_words (verse_number);`)
  db.exec(`CREATE INDEX text_words_paragraph_id ON text_words (paragraph_id);`)
  db.exec(`CREATE INDEX text_words_sentence_id ON text_words (sentence_id);`)
  db.exec(`CREATE INDEX text_words_clause_id ON text_words (clause_id);`)
}

function extractTextIntoDb (db) {
  const insertStatement = db.prepare(`INSERT INTO text_words (
    id,
    text, text_unaccented, text_lemma,
    gloss_word, gloss_interlinear,
    book_id, chapter_number, verse_number, paragraph_id, sentence_id, clause_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  let paragraphCounter = 1
  let sentenceCounter = 1

  return new Promise((resolve, reject) => {
    db.exec('BEGIN;')
    fs.createReadStream(path.join(__dirname, 'rawtexts/OpenGNT_version3_3.csv'))
      .pipe(csv({ separator: '\t' }))
      .on('data', data => {
        // split combined columns
        Object.keys(data).forEach(key => {
          if (key.startsWith('〔')) {
            const value = data[key]
            delete data[key]

            const subkeys = key.replace('〔', '').replace('〕', '').split('｜')
            const subvalues = value.replace('〔', '').replace('〕', '').split('｜')
            subkeys.forEach((k, idx) => {
              data[k] = subvalues[idx]
            })
          }
        })

        const leftPunctuation = extractPunctuation(data['PMpWord'])
        const rightPunctuation = extractPunctuation(data['PMfWord'])

        if (rightPunctuation.includes('¶')) {
          paragraphCounter++
        }
        if (rightPunctuation.includes('.')) {
          sentenceCounter++
        }

        const wordId = parseInt(data['OGNTsort'])

        const text = leftPunctuation + data['OGNTa'] + rightPunctuation.filter(p => p !== '¶')
        const textUnaccented = data['OGNTu']
        const textLemma = data['lexeme']

        const bookId = parseInt(data['Book'])
        const chapterNumber = parseInt(data['Chapter'])
        const verseNumber = parseInt(data['Verse'])

        const paragraphId = paragraphCounter
        const sentenceId = sentenceCounter
        const clauseId = parseInt(data['LevinsohnClauseID'].substring(1))

        const glossWord = data['TBESG']
        const glossInterlinear = data['LT']

        console.log({ bookId, paragraphId,  wordId, text })
        insertStatement.run(
          wordId,
          text, textUnaccented, textLemma,
          glossWord, glossInterlinear,
          bookId, chapterNumber, verseNumber, paragraphId, sentenceId, clauseId)
      })
      .on('error', e => {
        db.exec('ROLLBACK;')
        reject(e)
      })
      .on('end', () => {
        db.exec('COMMIT;')
        resolve()
      })
  })
}

function extractPunctuation (xmlString) {
  return xmlString.replace(/<pm>|<\/pm>/g, '').split('')
}

main().then(null, e => console.error('Crash', e))
