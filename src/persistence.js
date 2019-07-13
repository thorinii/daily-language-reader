const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const writeFileAtomic = require('write-file-atomic')


async function executeWithPersistentState (name, initial, fn) {
  const stateFilename = path.join(__dirname, '..', `state_${name}.json`)
  const inputState = await loadPersistentState(name, initial)

  const { state, result } = await fn(inputState)

  await promisify(writeFileAtomic)(
    stateFilename,
    JSON.stringify(state, null, '  '))

  return result
}

async function loadPersistentState (name, initial) {
  const stateFilename = path.join(__dirname, '..', `state_${name}.json`)

  let inputState = initial

  try {
    const content = await promisify(fs.readFile)(stateFilename)
    if (content !== '') inputState = JSON.parse(content)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }

  return inputState
}


module.exports = {
  loadPersistentState,
  executeWithPersistentState,
}
