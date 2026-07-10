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