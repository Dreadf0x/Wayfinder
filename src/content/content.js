/*
 * Wayfinder - content.js
 *
 * Purpose:
 * Implements a DOM-based Canvas module progress tracker that reads
 * information directly from the visible Canvas Modules page.
 *
 * This file scans Canvas module and module-item HTML elements, extracts
 * module and item titles, ignores detected text headers, and uses title
 * keywords such as Training, Lab, Important, and Assessment to decide
 * which items are considered required.
 *
 * It estimates whether those required items are complete by examining
 * visible text, CSS classes, ARIA labels, and HTML for completion or
 * incomplete status signals.
 *
 * The file then calculates per-module and overall progress percentages,
 * creates the Wayfinder tracker UI, displays required items and progress
 * bars, and provides a refresh button.
 *
 * Unlike the newer API-driven Wayfinder application, this file relies
 * primarily on Canvas page DOM content rather than Canvas REST API data.
 */

import { initializeApp } from "../app.js";

initializeApp();
