// @flow

import { KEY_PREFIX, REHYDRATE } from './constants'

import type { Persistoid, PersistConfig, Transform } from './types'
import changesetAccumulator from './changesetAcculmulator'

type IntervalID = any // @TODO remove once flow < 0.63 support is no longer required.

export default function createPersistoid(config: PersistConfig): Persistoid {
  // defaults
  const blacklist: ?Array<string> = config.blacklist || null
  const whitelist: ?Array<string> = config.whitelist || null
  const transforms = config.transforms || []
  const throttle = config.throttle || 0
  const storage = config.storage
  const serialize = config.serialize === false ? x => x : defaultSerialize
  const serializationLevel = config.serializationLevel || 0
  // initialize stateful values
  let lastState = {}
  let changeSet
  let timeIterator: ?IntervalID = null
  let writePromise = null

  const update = (state: Object) => {
    const changes = changesetAccumulator(
      config.key,
      lastState,
      state,
      serializationLevel
    )
    if (changes.add.length || changes.delete.length) {
      changeSet = {
        key: config.key,
        add: changes.add,
        delete: changes.delete,
      }
    }
    // start the time iterator if not running (read: throttle)
    if (timeIterator === null) {
      timeIterator = setTimeout(writeStagedState, throttle)
    }
    lastState = state
  }

  function writeStagedState() {
    if (!changeSet) {
      if (timeIterator) clearTimeout(timeIterator)
      timeIterator = null
      return
    }

    writePromise = storage
      .multiSet(config.key, changeSet.add)
      .catch(onWriteFail)

    changeSet = null
    timeIterator = null
  }

  function passWhitelistBlacklist(key) {
    if (whitelist && whitelist.indexOf(key) === -1 && key !== '_persist')
      return false
    if (blacklist && blacklist.indexOf(key) !== -1) return false
    return true
  }

  function onWriteFail(err) {
    // @TODO add fail handlers (typically storage full)
    if (err && process.env.NODE_ENV !== 'production') {
      console.error('Error storing data', err)
    }
  }

  const flush = () => {
    if (changeSet) {
      writeStagedState()
    }
    return writePromise || Promise.resolve()
  }

  // return `persistoid`
  return {
    update,
    flush,
  }
}

// @NOTE in the future this may be exposed via config
function defaultSerialize(data) {
  return JSON.stringify(data)
}
