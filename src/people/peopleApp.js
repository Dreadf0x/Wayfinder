import { loadEndDates } from "./peopleStorage.js";


function loadRadarStyles() {
  if (document.getElementById("wayfinder-radar-css")) return;

  const link = document.createElement("link");
  link.id = "wayfinder-radar-css";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("people/radar.css");

  document.head.appendChild(link);
}


import {
  getCourseStudents,
  getRadarAssignments,
  getSubmissionsForAssignment
} from "./peopleApi.js";
import { renderStudentRadar } from "./peopleRenderer.js";

function getCourseIdFromUrl() {
  const match = window.location.pathname.match(/\/courses\/(\d+)\/users/);
  return match ? match[1] : null;
}

export async function initializePeopleView() {
    
    loadRadarStyles();
  
    console.log("Wayfinder Student Radar");

  const courseId = getCourseIdFromUrl();

  const panel = document.createElement("div");
  panel.id = "cpt-progress-tracker";

  panel.innerHTML = renderStudentRadar({
    students: [],
    loading: true
  });

  document.body.appendChild(panel);

  try {
    const students = await getCourseStudents(courseId);
    const endDates = await loadEndDates(courseId);


   const radarAssignments = await getRadarAssignments(courseId);

    const submissionsByStudentId = {};

    for (const assignment of radarAssignments) {
    const submissions = await getSubmissionsForAssignment(courseId, assignment.id);

    for (const submission of submissions) {
        const studentId = String(submission.user_id);

        if (!submissionsByStudentId[studentId]) {
        submissionsByStudentId[studentId] = [];
        }

        submissionsByStudentId[studentId].push(submission);
    }
    }

    const totalAssessments = radarAssignments.length;

    const studentsWithProgress = students.map((student) => {
    const studentSubmissions = submissionsByStudentId[String(student.id)] || [];

    const submittedCount = studentSubmissions.filter((submission) =>
        Boolean(submission.submitted_at)
    ).length;

    const gradedCount = studentSubmissions.filter((submission) =>
        submission.grade !== null &&
        submission.grade !== undefined &&
        submission.workflow_state === "graded"
    ).length;

    return {
        ...student,
        submittedPercent:
        totalAssessments === 0 ? null : Math.round((submittedCount / totalAssessments) * 100),
        gradedPercent:
        totalAssessments === 0 ? null : Math.round((gradedCount / totalAssessments) * 100)
    };
    });

    panel.innerHTML = renderStudentRadar({
        students: studentsWithProgress,
        endDates,
        loading: false
    });
  } catch (error) {
    panel.innerHTML = renderStudentRadar({
      students: [],
      loading: false,
      error: error.message
    });
  }
}