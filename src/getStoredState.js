// @flow

import type { PersistConfig } from './types'

import { KEY_PREFIX } from './constants'

export default function getStoredState(
  config: PersistConfig
): Promise<Object | void> {
  const transforms = config.transforms || []
  const storage = config.storage
  const debug = config.debug
  const deserialize = config.serialize === false ? x => x : defaultDeserialize
  //TODO: catch error and make it async await
  let dbConnectPromise
  if (config.dbConnectionRequired && typeof storage.openDb === 'function') {
    dbConnectPromise = storage.openDb(config.dbName)
  } else {
    dbConnectPromise = new Promise((resolve, reject) => {
      setTimeout(resolve, 0)
    })
  }

  return dbConnectPromise.then(() =>
    storage.multiGet(config.key).then(results => {
      debugger
      if (!results || !results.length) return undefined
      else {
        try {
          let state = reconstructState(results, config.serializationLevel)
          return state[config.key]
        } catch (err) {
          if (process.env.NODE_ENV !== 'production' && debug)
            console.log(
              `redux-persist/getStoredState: Error restoring data for ${
                config.key
              }`,
              err
            )
          throw err
        }
      }
    })
  )
}

function reconstructState(resultsArr: any = [], serializationLevel = 0) {
  if (serializationLevel === 0) {
    //TODO:why array of array is sent
    return getDeserializedState(resultsArr[0][0])
  }
  //collect parent level object
  const parents = []
  resultsArr.forEach((item: any) => {
    //TODO: why array of array is sent
    item = item[0]
    if (item.key.split('.').length <= serializationLevel) {
      parents.push(item)
    }
  })

  let state = createParentStructure(parents, 0, serializationLevel, {}, 0)

  //accumulate children
  state = resultsArr.reduce((state, item: any) => {
    item = item[0]
    const paths = item.key.split('.')
    if (paths.length <= serializationLevel) {
      return state
    }
    return createByPath(state, paths, JSON.parse(item[item.key]))
  }, state)

  return state
}

function createParentStructure(
  parentsArr,
  level,
  serializationLevel,
  acc,
  count
) {
  if (count == parentsArr.length) {
    return acc
  }
  const levelObjects: Array<any> = parentsArr.filter(
    item => item.key.split('.').length == level + 1
  )
  //TODO: what if this is a primitive
  levelObjects.forEach((obj: any) => {
    acc = createByPath(acc, obj.key.split('.'), JSON.parse(obj[obj.key]))
  })
  return createParentStructure(
    parentsArr,
    level + 1,
    serializationLevel,
    acc,
    count + levelObjects.length
  )
}

function createByPath(parent: any, paths: Array<string>, value) {
  let obj = parent
  for (let i = 0; i < paths.length; ++i) {
    if (obj[paths[i]] == undefined) {
      obj[paths[i]] = value
      return parent
    } else {
      obj = obj[paths[i]]
    }
  }
}

function getDeserializedState(serializedState) {
  return {
    [serializedState.key]: JSON.parse(serializedState[serializedState.key]),
  }
}

function defaultDeserialize(serial) {
  return JSON.parse(serial)
}
