export function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key]));
  });
}

export function storageSet(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, resolve);
  });
}

export function getRulesStorageKey(courseId) {
  return `cpt_rules_course_${courseId}`;
}

export function getUiStorageKey(courseId) {
  return `cpt_ui_course_${courseId}`;
}

export async function loadRules(courseId) {
  return (await storageGet(getRulesStorageKey(courseId))) || {};
}

export async function saveRules(courseId, rules) {
  await storageSet({ [getRulesStorageKey(courseId)]: rules });
}

export async function loadUiState(courseId) {
  return (await storageGet(getUiStorageKey(courseId))) || {};
}

export async function saveUiState(courseId, collapsed) {
  await storageSet({
    [getUiStorageKey(courseId)]: {
      collapsed
    }
  });
}// Chrome storage helpers will move here during refactor.
