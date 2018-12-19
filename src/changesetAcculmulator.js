export default function changesetAccumulator(
  rootKey: string,
  lastState: any,
  currentState: any,
  serializationLevel: number
): Array<any> {
  let currentLevel = 0
  let changeSet = {
    add: [],
    delete: [],
  }
  accumulateChanges(
    null,
    rootKey,
    lastState || {},
    currentState,
    serializationLevel,
    currentLevel,
    changeSet
  )
  return changeSet
}

function accumulateChanges(
  prefixKey: string,
  key: string,
  lastState: any,
  currentState: any,
  serializationLevel: number,
  currentLevel: number,
  accumulator: Array<any>
): void {
  //if references are same then return
  if (currentState == lastState) {
    return
  }

  if (currentLevel === serializationLevel) {
    accumulator.add.push(createChangesetItem(prefixKey, key, currentState))
    return
  }

  //if array or an object key iterate else store directly
  if (Array.isArray(currentState)) {
    //store the blank array as key so that we know the type when we deserialize
    accumulator.add.push(createChangesetItem(prefixKey, key, []))
    currentState[key].forEach((item, index) => {
      accumulateChanges(
        getComputedKey(prefixKey, key),
        index,
        lastState[index] || {},
        currentState[index],
        serializationLevel,
        currentLevel + 1,
        accumulator
      )
    })
  } else if (typeof currentState === 'object' && currentState !== null) {
    //store the blank object as key so that we know the type when we deserialize
    accumulator.add.push(createChangesetItem(prefixKey, key, {}))
    for (const itemKey of Object.keys(currentState)) {
      accumulateChanges(
        getComputedKey(prefixKey, key),
        itemKey,
        lastState[itemKey] || {},
        currentState[itemKey],
        serializationLevel,
        currentLevel + 1,
        accumulator
      )
    }
  } else {
    //it is a primitive type store as it is
    accumulator.add.push(createChangesetItem(prefixKey, key, currentState))
  }
}

function getComputedKey(prefixKey, key) {
  return prefixKey ? `${prefixKey}.${key}` : key
}

function createChangesetItem(prefixKey, key, value) {
  const computedKey = getComputedKey(prefixKey, key)
  return {
    [computedKey]: JSON.stringify(value),
  }
}
