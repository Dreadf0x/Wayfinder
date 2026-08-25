/*
 * Wayfinder - peopleStorage.js
 *
 * Purpose:
 * Provides Chrome local-storage helpers for Student Radar state that
 * should persist between browser sessions.
 *
 * Data is stored in chrome.storage.local using keys that include the
 * Canvas course ID so information from different courses remains
 * separate.
 *
 * This file stores and retrieves:
 *
 * - Per-student End Dates
 * - Instructor-selected Required Item IDs
 * - Student Radar collapsed/expanded UI state
 *
 * A null Required Items result specifically means the instructor has
 * never saved a custom selection for that course, allowing peopleApp.js
 * to apply its default selection behavior.
 *
 * Required-item IDs are deduplicated before storage.
 *
 * This file stores Wayfinder application state only. It does not store
 * Canvas usernames, passwords, or Canvas session cookies.
 */

function getEndDateKey(courseId) {
  return `wayfinder_student_radar_end_dates_${courseId}`;
}

export async function loadEndDates(courseId) {
  const key = getEndDateKey(courseId);
  const result = await chrome.storage.local.get(key);
  return result[key] || {};
}

export async function saveEndDate(courseId, studentId, endDate) {
  const key = getEndDateKey(courseId);
  const result = await chrome.storage.local.get(key);
  const endDates = result[key] || {};

  if (endDate) {
    endDates[String(studentId)] = endDate;
  } else {
    delete endDates[String(studentId)];
  }

  await chrome.storage.local.set({
    [key]: endDates
  });
}

function getRequiredItemsKey(courseId) {
  return `wayfinder_student_radar_required_items_${courseId}`;
}

export async function loadRequiredItemIds(courseId) {
  const key = getRequiredItemsKey(courseId);
  const result = await chrome.storage.local.get(key);

  // null means the instructor has never saved a custom selection.
  return Array.isArray(result[key]) ? result[key].map(String) : null;
}

export async function saveRequiredItemIds(courseId, assignmentIds) {
  const key = getRequiredItemsKey(courseId);

  const cleanIds = Array.from(
    new Set((assignmentIds || []).map(String))
  );

  await chrome.storage.local.set({
    [key]: cleanIds
  });
}

export async function clearRequiredItemIds(courseId) {
  const key = getRequiredItemsKey(courseId);
  await chrome.storage.local.remove(key);
}

function getRadarUiStateKey(courseId) {
  return `wayfinder_student_radar_ui_${courseId}`;
}

export async function loadRadarUiState(courseId) {
  const key = getRadarUiStateKey(courseId);
  const result = await chrome.storage.local.get(key);

  return {
    collapsed: Boolean(result[key]?.collapsed)
  };
}

export async function saveRadarUiState(
  courseId,
  uiState
) {
  const key = getRadarUiStateKey(courseId);

  await chrome.storage.local.set({
    [key]: {
      collapsed: Boolean(uiState?.collapsed)
    }
  });
}