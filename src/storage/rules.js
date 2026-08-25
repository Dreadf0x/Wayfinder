/*
 * Wayfinder - rules.js
 *
 * Purpose:
 * Provides Chrome local-storage helpers for the Modules-page Wayfinder
 * instructor rules and user-interface state.
 *
 * This file wraps chrome.storage.local in Promise-based storageGet()
 * and storageSet() helpers.
 *
 * Stored information is scoped by Canvas course ID using separate
 * storage keys for:
 *
 * - Required-item/custom module rules
 * - Wayfinder UI state
 *
 * loadRules() and saveRules() manage locally saved instructor rule
 * configuration for a course.
 *
 * loadUiState() and saveUiState() manage course-specific interface
 * preferences such as collapsed state and other UI settings supplied
 * by the application.
 *
 * If no saved value exists, the load functions return an empty object.
 *
 * This file stores Wayfinder application configuration only. It does
 * not manage Canvas authentication credentials or Canvas API data.
 */


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

export async function saveUiState(courseId, uiState) {
  await storageSet({
    [getUiStorageKey(courseId)]: uiState
  });
}

