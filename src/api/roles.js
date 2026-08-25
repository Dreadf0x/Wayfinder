/*
 * Wayfinder - roles.js
 *
 * Purpose:
 * Determines whether the current user should be treated by Wayfinder
 * as an instructor or a student for a specific Canvas course.
 *
 * The detector examines Canvas-provided course permissions such as
 * assignment, grade, student, and course-management permissions.
 *
 * It also checks the user's Canvas enrollment types for instructor
 * signals such as Teacher, TA, or Designer.
 *
 * If any instructor-level permission or enrollment is detected, the
 * function returns "instructor". Otherwise it returns "student".
 *
 * Canvas remains the source of truth for the user's course role.
 */


export function detectRoleFromPermissions(course) {
  const permissions = course?.permissions || {};
  const enrollmentTypes = (course?.enrollments || []).map((enrollment) =>
    String(enrollment.type || "").toLowerCase()
  );

  const instructorSignals = [
    permissions.manage_assignments,
    permissions.manage_grades,
    permissions.manage_students,
    permissions.update
  ];

  const instructorEnrollment = enrollmentTypes.some((type) =>
    type.includes("teacher") ||
    type.includes("ta") ||
    type.includes("designer")
  );

  return instructorSignals.some(Boolean) || instructorEnrollment
    ? "instructor"
    : "student";
}