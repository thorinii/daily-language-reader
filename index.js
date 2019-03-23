const fs = require('fs')
const path = require('path')

const bodyParser = require('body-parser')
const csv = require('csv-parser')
const express = require('express')
const Database = require('better-sqlite3')

async function main () {
  const db = new Database('database.sqlite3')
  db.function('sqrt', { deterministic: true }, (a) => Math.sqrt(a))
  db.function('log', { deterministic: true }, (a) => Math.log(a))
  db.aggregate('mul', {
    start: 1,
    step: (total, nextValue) => total * nextValue,
  });

  if (!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = 'text_words' ORDER BY name;`).get()) {
    installDb(db)
    await extractTextIntoDb(db)
    addIndexes(db)
  }
  updateCosts(db)


  const app = express()
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'layouttest.html'))
  })
  app.get('/reading.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'reading.css'))
  })
  app.get('/api/text', (req, res) => {
    const wordsOfVerse = db.prepare('select id, text, text_lemma, gloss_interlinear, book_id, chapter_number, verse_number, paragraph_id, sentence_id, clause_id from text_words WHERE book_id = 64 AND verse_number IN (2, 3) ORDER BY id ASC;').all()
    res.json(wordsOfVerse)
  })
  app.get('/test', (req, res) => {
    const wordsOfVerse = db.prepare('select id, text, text_lemma, gloss_interlinear, book_id, chapter_number, verse_number, paragraph_id, sentence_id, clause_id from text_words WHERE book_id = 64 AND verse_number IN (2, 3) ORDER BY id ASC;').all()

    function generate (words, useAnnotations) {
      let text = ''
      let currentVerse = null
      let currentParagraph = null
      let currentSentence = null

      words.forEach(word => {
        if (currentParagraph !== word.paragraph_id) {
          currentParagraph = word.paragraph_id
          if (text.length > 0) text += '</p>'
          text += '<p>'
        }
        if (currentSentence && currentSentence !== word.sentence_id) {
          currentSentence = word.sentence_id
          text += '<span class="sentence-break"></span>'
        } else if (!currentSentence) currentSentence = word.sentence_id

        if (currentVerse !== word.verse_number) {
          // TODO: this doesn't work on same verse #s from different books
          currentVerse = word.verse_number
          text += '<span class="verse-number">' + word.verse_number + '&nbsp;</span>'
        }

        if (useAnnotations) {
          text += `<span class="annotation-cell"><span class="original">${word.text}</span><span class="interlinear">${word.gloss_interlinear}</span></span> `
        } else {
          text += word.text + ' '
        }
      })

      text = text.trim()
      if (text.length > 0) text += '</p>'
      return text
    }

    res.contentType('html').send(`
<html>
  <head>
    <meta charset="utf8">

    <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css?family=Cardo" rel="stylesheet">

    <link rel="stylesheet" href="reading.css">
  </head>

  <body>
    <div class="application">

      <div>Large reader</div>
      <div class="reader ${ wordsOfVerse.length > 50 ? '' : 'large'}">
        <h1 class="reader-reference">ΙΩΑΝΝΟΥ Γ</h1>

        <div class="reader-text break-paragraphs">
          ${generate(wordsOfVerse, false)}
        </div>
      </div>

      <div>Annotated reader</div>
      <div class="reader ${ wordsOfVerse.length > 50 ? '' : 'large'} annotated">
        <h1 class="reader-reference">ΙΩΑΝΝΟΥ Γ</h1>

        <div class="reader-text break-paragraphs">
          ${generate(wordsOfVerse, true)}
        </div>
      </div>
    </div>
  </body>
</html>`)
  })

  app.use(function (err, req, res, next) {
    console.error(err)
    res.status(500).json({ error: err })
  })

  app.listen(3000, function () {
    console.log('Started GNTReader on port 3000')
  })

  process.on('exit', () => db.close());
  process.on('SIGHUP', () => process.exit(128 + 1));
  process.on('SIGINT', () => process.exit(128 + 2));
  process.on('SIGTERM', () => process.exit(128 + 15));
}

function installDb (db) {
  db.exec(`
    CREATE TABLE text_words (
      id INTEGER PRIMARY KEY,

      text TEXT NOT NULL,
      text_lone TEXT NOT NULL,
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

    CREATE TABLE stat_form (
      id INTEGER PRIMARY KEY,

      text TEXT NOT NULL,
      lexeme_id INTEGER NOT NULL,

      gloss_word TEXT NOT NULL,

      frequency INTEGER NOT NULL,
      raw_frequency_cost DOUBLE NOT NULL,
      cost DOUBLE NOT NULL
    );

    CREATE TABLE stat_lexeme (
      id INTEGER PRIMARY KEY,

      text TEXT NOT NULL,

      frequency INTEGER NOT NULL,
      raw_frequency_cost DOUBLE NOT NULL,
      cost DOUBLE NOT NULL
    );

    CREATE TABLE text_sentence (
      id INTEGER PRIMARY KEY,

      length INTEGER NOT NULL,
      unique_length INTEGER NOT NULL,
      average_form_cost DOUBLE NOT NULL,
      total_unique_form_cost DOUBLE NOT NULL,
      geometric_unique_form_cost DOUBLE NOT NULL
    );

    CREATE TABLE text_clause (
      id INTEGER PRIMARY KEY,

      length INTEGER NOT NULL,
      unique_length INTEGER NOT NULL,
      average_form_cost DOUBLE NOT NULL,
      total_unique_form_cost DOUBLE NOT NULL,
      geometric_unique_form_cost DOUBLE NOT NULL
    );
  `)
}

function addIndexes (db) {
  console.log('creating column indexes')
  db.exec(`CREATE INDEX text_words_text ON text_words (text);`)
  db.exec(`CREATE INDEX text_words_text_lone ON text_words (text_lone);`)
  db.exec(`CREATE INDEX text_words_text_unaccented ON text_words (text_unaccented);`)
  db.exec(`CREATE INDEX text_words_text_lemma ON text_words (text_lemma);`)

  db.exec(`CREATE INDEX text_words_book_id ON text_words (book_id);`)
  db.exec(`CREATE INDEX text_words_chapter_number ON text_words (chapter_number);`)
  db.exec(`CREATE INDEX text_words_verse_number ON text_words (verse_number);`)
  db.exec(`CREATE INDEX text_words_paragraph_id ON text_words (paragraph_id);`)
  db.exec(`CREATE INDEX text_words_sentence_id ON text_words (sentence_id);`)
  db.exec(`CREATE INDEX text_words_clause_id ON text_words (clause_id);`)


  console.log('creating statistical indexes')
  db.prepare(`
    INSERT INTO stat_lexeme (text, frequency, raw_frequency_cost, cost)
      SELECT text_lemma, COUNT(*) AS frequency, 0, 0
      FROM text_words
      GROUP BY text_lemma
      ORDER BY frequency DESC;`).run()
  db.prepare(`UPDATE stat_lexeme SET raw_frequency_cost = round(sqrt(id), 1);`).run()

  db.prepare(`
    INSERT INTO stat_form (text, lexeme_id, gloss_word, frequency, raw_frequency_cost, cost)
      SELECT text_lone, (SELECT id FROM stat_lexeme WHERE text = text_lemma), gloss_word, COUNT(*) AS frequency, 0, 0
      FROM text_words
      GROUP BY text_lone
      ORDER BY frequency DESC;`).run()
  db.prepare(`UPDATE stat_form SET raw_frequency_cost = round(sqrt(id), 1);`).run()

  db.exec(`CREATE INDEX stat_lexeme_text ON stat_lexeme (text);`)
  db.exec(`CREATE INDEX stat_lexeme_cost ON stat_lexeme (cost);`)

  db.exec(`CREATE INDEX stat_form_text ON stat_form (text);`)
  db.exec(`CREATE INDEX stat_form_lexeme_id ON stat_form (lexeme_id);`)
  db.exec(`CREATE INDEX stat_form_cost ON stat_form (cost);`)


  db.prepare(`
    INSERT INTO text_sentence (id, length, unique_length, average_form_cost, total_unique_form_cost, geometric_unique_form_cost)
      SELECT sentence_id, COUNT(*), 0, 0, 0, 0
      FROM text_words
      GROUP BY sentence_id;`).run()
  db.prepare(`
    UPDATE text_sentence
    SET unique_length = (
      SELECT COUNT(*)
      FROM (
        SELECT text_lone
        FROM text_words
        WHERE sentence_id = text_sentence.id
        GROUP BY text_lone));`).run()

  db.exec(`CREATE INDEX text_sentence_length ON text_sentence (length);`)
  db.exec(`CREATE INDEX text_sentence_unique_length ON text_sentence (unique_length);`)
  db.exec(`CREATE INDEX text_sentence_average_form_cost ON text_sentence (average_form_cost);`)
  db.exec(`CREATE INDEX text_sentence_total_unique_form_cost ON text_sentence (total_unique_form_cost);`)
  db.exec(`CREATE INDEX text_sentence_geometric_unique_form_cost ON text_sentence (geometric_unique_form_cost);`)


  db.prepare(`
    INSERT INTO text_clause (id, length, unique_length, average_form_cost, total_unique_form_cost, geometric_unique_form_cost)
      SELECT clause_id, COUNT(*), 0, 0, 0, 0
      FROM text_words
      GROUP BY clause_id;`).run()
  db.prepare(`
    UPDATE text_clause
    SET unique_length = (
      SELECT COUNT(*)
      FROM (
        SELECT text_lone
        FROM text_words
        WHERE clause_id = text_clause.id
        GROUP BY text_lone));`).run()

  db.exec(`CREATE INDEX text_clause_length ON text_clause (length);`)
  db.exec(`CREATE INDEX text_clause_unique_length ON text_clause (unique_length);`)
  db.exec(`CREATE INDEX text_clause_average_form_cost ON text_clause (average_form_cost);`)
  db.exec(`CREATE INDEX text_clause_total_unique_form_cost ON text_clause (total_unique_form_cost);`)
  db.exec(`CREATE INDEX text_clause_geometric_unique_form_cost ON text_clause (geometric_unique_form_cost);`)
}

function updateCosts (db) {
  console.log('updating costs')
  db.prepare(`UPDATE stat_lexeme SET cost = raw_frequency_cost;`).run()

  db.prepare(`UPDATE stat_form SET cost = raw_frequency_cost;`).run()
  db.prepare(`
    UPDATE stat_form SET cost = min(cost, round(cost * 0.4 + 0.6 * (
      SELECT min(cost)
      FROM stat_form cheapest
      WHERE cheapest.lexeme_id = stat_form.lexeme_id
      GROUP BY cheapest.lexeme_id), 2));`).run()

/*
select id, text, raw_frequency_cost, cost, min(cost, (
	select min(cost) + 1
	from stat_form b
	where b.lexeme_id = x.lexeme_id
	group by lexeme_id)) mincost
from stat_form x
order by cost
limit 30
*/


  db.prepare(`
    UPDATE text_sentence
    SET average_form_cost = (
      SELECT round(avg(rfc.cost), 1) FROM (
        SELECT text_lone, cost
        FROM (
          SELECT text_lone
          FROM text_words
          WHERE sentence_id = text_sentence.id
          GROUP BY text_lone) AS unique_words
        JOIN stat_form ON stat_form.text = unique_words.text_lone) AS rfc);`).run()

  db.prepare(`
    UPDATE text_sentence
    SET total_unique_form_cost = (
      SELECT sum(rfc.cost) FROM (
        SELECT text_lone, cost
        FROM (
          SELECT text_lone
          FROM text_words
          WHERE sentence_id = text_sentence.id
          GROUP BY text_lone) AS unique_words
        JOIN stat_form ON stat_form.text = unique_words.text_lone) AS rfc);`).run()

  db.prepare(`
    UPDATE text_sentence
    SET geometric_unique_form_cost = (
      SELECT mul(rfc.cost) FROM (
        SELECT text_lone, cost
        FROM (
          SELECT text_lone
          FROM text_words
          WHERE sentence_id = text_sentence.id
          GROUP BY text_lone) AS unique_words
        JOIN stat_form ON stat_form.text = unique_words.text_lone) AS rfc);`).run()


  db.prepare(`
    UPDATE text_clause
    SET average_form_cost = (
      SELECT round(avg(rfc.cost), 1) FROM (
        SELECT text_lone, cost
        FROM (
          SELECT text_lone
          FROM text_words
          WHERE clause_id = text_clause.id
          GROUP BY text_lone) AS unique_words
        JOIN stat_form ON stat_form.text = unique_words.text_lone) AS rfc);`).run()

  db.prepare(`
    UPDATE text_clause
    SET total_unique_form_cost = (
      SELECT sum(rfc.cost) FROM (
        SELECT text_lone, cost
        FROM (
          SELECT text_lone
          FROM text_words
          WHERE clause_id = text_clause.id
          GROUP BY text_lone) AS unique_words
        JOIN stat_form ON stat_form.text = unique_words.text_lone) AS rfc);`).run()

  db.prepare(`
    UPDATE text_clause
    SET geometric_unique_form_cost = (
      SELECT mul(rfc.cost) FROM (
        SELECT text_lone, cost
        FROM (
          SELECT text_lone
          FROM text_words
          WHERE clause_id = text_clause.id
          GROUP BY text_lone) AS unique_words
        JOIN stat_form ON stat_form.text = unique_words.text_lone) AS rfc);`).run()


  console.log('by length')
  console.log(db.prepare('select id, length from text_sentence ORDER BY length ASC LIMIT 5;').all())
  console.log(db.prepare('select id, length from text_sentence ORDER BY length DESC LIMIT 5;').all())

  console.log('by average raw form frequency cost')
  console.log(db.prepare(`
    SELECT group_concat(gloss_interlinear, ' ') AS stext
    FROM text_words
    WHERE sentence_id IN (
      SELECT id
      FROM text_sentence
      WHERE length > 2
      ORDER BY average_form_cost
      LIMIT 5)
    GROUP BY sentence_id`).all())

  console.log('by total raw form frequency cost')
  console.log(db.prepare(`
    SELECT group_concat(gloss_interlinear, ' ') AS stext
    FROM text_words
    WHERE sentence_id IN (
      SELECT id
      FROM text_sentence
      WHERE length > 2
      ORDER BY total_unique_form_cost
      LIMIT 5)
    GROUP BY sentence_id`).all())

  console.log('by geometric raw form frequency cost')
  console.log(db.prepare(`
    SELECT group_concat(gloss_interlinear, ' ') AS stext
    FROM text_words
    WHERE sentence_id IN (
      SELECT id
      FROM text_sentence
      WHERE length > 2
      ORDER BY geometric_unique_form_cost
      LIMIT 5)
    GROUP BY sentence_id`).all())


  console.log('by length')
  console.log(db.prepare('select id, length from text_clause ORDER BY length ASC LIMIT 5;').all())
  console.log(db.prepare('select id, length from text_clause ORDER BY length DESC LIMIT 5;').all())

  console.log('by average raw form frequency cost')
  console.log(db.prepare(`
    SELECT group_concat(gloss_interlinear, ' ') AS stext
    FROM text_words
    WHERE clause_id IN (
      SELECT id
      FROM text_clause
      WHERE length > 2
      ORDER BY average_form_cost
      LIMIT 8)
    GROUP BY clause_id`).all())

  console.log('by total raw form frequency cost')
  console.log(db.prepare(`
    SELECT group_concat(gloss_interlinear, ' ') AS stext
    FROM text_words
    WHERE clause_id IN (
      SELECT id
      FROM text_clause
      WHERE length > 2
      ORDER BY total_unique_form_cost
      LIMIT 8)
    GROUP BY clause_id`).all())

  console.log('by geometric raw form frequency cost')
  console.log(db.prepare(`
    SELECT group_concat(gloss_interlinear, ' ') AS stext
    FROM text_words
    WHERE clause_id IN (
      SELECT id
      FROM text_clause
      WHERE length > 2
      ORDER BY geometric_unique_form_cost
      LIMIT 8)
    GROUP BY clause_id`).all())
}

function extractTextIntoDb (db) {
  const insertStatement = db.prepare(`INSERT INTO text_words (
    id,
    text, text_lone, text_unaccented, text_lemma,
    gloss_word, gloss_interlinear,
    book_id, chapter_number, verse_number, paragraph_id, sentence_id, clause_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  let previousBookId = null

  let newParagraph = false
  let newSentence = false
  let paragraphCounter = 1
  let sentenceCounter = 1

  let wordCounter = 0

  return new Promise((resolve, reject) => {
    // validating SQL:
    //   select a.id, b.id, b.paragraph_id - a.paragraph_id, b.sentence_id - a.sentence_id
    //   from text_words a
    //   join text_words b
    //   where a.id = b.id - 1
    //     and a.book_id = b.book_id - 1

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

        const wordId = parseInt(data['OGNTsort'])

        const text = leftPunctuation + data['OGNTa'] + rightPunctuation.filter(p => p !== '¶')
        const textLone = data['OGNTa'].toLowerCase()
        const textUnaccented = data['OGNTu']
        const textLemma = data['lexeme']

        const bookId = parseInt(data['Book'])
        const chapterNumber = parseInt(data['Chapter'])
        const verseNumber = parseInt(data['Verse'])

        const glossWord = data['TBESG']
        const glossInterlinear = data['LT']

        if (previousBookId !== bookId) {
          previousBookId = bookId
          newParagraph = true
          newSentence = true
        }
        if (newParagraph) {
          paragraphCounter++
          newParagraph = false
        }
        if (newSentence) {
          sentenceCounter++
          newSentence = false
        }

        const paragraphId = paragraphCounter
        const sentenceId = sentenceCounter
        const clauseId = parseInt(data['LevinsohnClauseID'].substring(1))

        if (rightPunctuation.includes('¶')) {
          newParagraph = true
        }
        if (rightPunctuation.includes('.')) {
          newSentence = true
        }

        insertStatement.run(
          wordId,
          text, textLone, textUnaccented, textLemma,
          glossWord, glossInterlinear,
          bookId, chapterNumber, verseNumber, paragraphId, sentenceId, clauseId)

        wordCounter++
        if (wordCounter % 1000 === 0) {
          console.log('In book %d, loaded %d words', bookId, wordCounter)
        }
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
