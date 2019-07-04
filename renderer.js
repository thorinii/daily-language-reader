/**
 * Renderer -- takes a list of text/interlinear blocks and formats them as HTML
 * or text.
 *
 * Usage: node renderer.js <html|text>
 */

const wrap = require('wordwrap')(80)
const { readStdin } = require('./utils')

if (process.argv.length !== 3) {
  console.warn('Usage: node renderer.js <html|text>')
  return
}

const styles = `
* {
  max-width: 60ch;
}
html {
  font-family: sans-serif;
  font-size: 14pt;
  max-width: initial;
  width: 100%;
}
body {
  margin: 2em auto;
}
`

const format = process.argv[2]
const prologue = format === 'text' ? '' : '<html>\n<body>\n'
const joiner = format === 'text' ? '\n\n-------\n\n' : '\n<hr>\n'
const epilogue = format === 'text' ? '' : '\n<style>' + styles + '</style></body>\n</html>'

const blocks = readStdin()
  .split('\n')
  .map(text => text.trim())
  .filter(t => t)
  .map(text => JSON.parse(text))

const formatted = blocks
  .map(block => {
    const centerIndex = (block.text.length / 2) | 0

    if (format === 'text') {
      const text = wrap(highlight(block.text).join(' | '))
      const interlinear = wrap(highlight(block.interlinear).join(' '))
      return text + '\n\n' + interlinear
    } else {
      const text = wrap(highlight(block.text).join(' | '))
      const interlinear = wrap(highlight(block.interlinear).join(' '))
      return '<p>' + text + '</p>\n<p>' + interlinear + '</p>'
    }

    function highlight (array) {
      if (format === 'text') {
        return array.map((s, idx) => idx === centerIndex ? `*${s}*` : s)
      } else {
        return array.map((s, idx) => idx === centerIndex ? `<strong>${s}</strong>` : s)
      }
    }
  })

console.log(prologue + formatted.join(joiner) + epilogue)
