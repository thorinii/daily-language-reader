const wrap = require('wordwrap')(80)


/**
 * Renders a passage into blocks of rendered words.
 *
 * Options: {
 *   divisionIndex: String  name of the index to use for dividing the text
 *   tokenRendering: ID => String  type of rendering for each token
 * }
 */
function renderPassage (passage, options) {
  const invisiblePunctation = /[ ¶]+/g
  const allPunctation = /[“”:?,.;·¶-]+/g

  const blocks = divideBlocks(passage, options.divisionIndex || null)
  return blocks
    .map(b => formatBlock(b, options.tokenRendering || {}))


  function divideBlocks (passage, divisionIndex) {
    if (divisionIndex === null) return [passage.tokens]
    const index = passage[divisionIndex + 's']

    return index.map(slice => {
      return passage.tokens.filter(t =>
        t.token_id >= slice.start && t.token_id <= slice.end)
    })
  }


  function formatBlock (tokens, tokenRendering) {
    return tokens
      .map(t => {
        const native = t.word

        const cleanTranslation = t.translation_study === '-' ? null : t.translation_study.replace(allPunctation, '').trim()
        const translation = cleanTranslation || ''

        const parallel = cleanTranslation
          ? [t.word, cleanTranslation]
          : [t.word]

        const rendering = tokenRendering[t.token_id] || 'native'
        let text
        if (rendering === 'native') text = [native]
        else if (rendering === 'translation') text = [translation]
        else text = parallel

        return [
          t.punctuation_before.replace(invisiblePunctation, ''),
          text,
          t.punctuation_after.replace(invisiblePunctation, ''),
        ]
      })
  }
}

function formatAsText (rendering) {
  return rendering
    .map(block => wrap(formatBlock(block)))
    .join('\n\n')


  function formatBlock (stream) {
    return stream
      .map(word => {
        return word
          .map(piece => {
            if (Array.isArray(piece)) {
              return piece.map((s, idx) => {
                if (idx !== 0) return '(' + s + ')'
                else return s
              }).join(' ')
            } else {
              return piece
            }
          })
          .join('')
      })
      .filter(text => !!text)
      .join(' ')
  }
}

function formatAsHtml (rendering) {
  return rendering
    .map(block => (
      '<p style="font-size: 16pt; max-width: 50em; margin: auto; line-height: 1.6">' +
      wrap(formatBlock(block)) +
      '</p>'))
    .join('\n')


  function formatBlock (stream) {
    return stream
      .map(word => {
        return word
          .map(piece => {
            if (Array.isArray(piece) && piece.length > 1) {
              return (
                '<span style="display: inline-block; text-align: center; padding-bottom: 12px">' +
                piece.filter(p => p).map((p, idx) => idx > 0 ? `<span style="color: grey; line-height: 1">${p}</span>` : p).join('<br>') +
                '</span>')
            } else if (piece !== '') {
              return '<span style="vertical-align: top">' + piece + '</span>'
            }
          })
          .join('')
      })
      .filter(text => !!text)
      .join(' ')
  }
}


module.exports = {
  renderPassage,
  formatAsText,
  formatAsHtml,
}
