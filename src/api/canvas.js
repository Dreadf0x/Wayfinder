/*
 * Wayfinder - canvas.js
 *
 * Purpose:
 * Provides reusable helpers for reading data from the Canvas REST API.
 *
 * canvasFetch() performs a single authenticated Canvas API request
 * and returns the JSON response.
 *
 * canvasFetchAll() handles paginated Canvas API endpoints by following
 * the "next" URL from Canvas Link response headers until all pages
 * have been retrieved.
 *
 * Requests use credentials: "include", which allows the browser to
 * send the user's existing Canvas session credentials. Wayfinder does
 * not create or store a separate Canvas login session here.
 *
 * API errors are converted into JavaScript errors containing the
 * Canvas HTTP status, status text, and requested path.
 */



// Canvas API helpers will move here during refactor.
export async function canvasFetch(path) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Canvas API error ${response.status}: ${response.statusText} at ${path}`);
  }

  return response.json();
}

export async function canvasFetchAll(path) {
  let url = path;
  let results = [];

  while (url) {
    const response = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Canvas API error ${response.status}: ${response.statusText} at ${url}`);
    }

    const data = await response.json();
    results = results.concat(data);

    const link = response.headers.get("Link");
    url = getNextLink(link);
  }

  return results;
}

function getNextLink(linkHeader) {
  if (!linkHeader) return null;

  for (const link of linkHeader.split(",")) {
    const parts = link.split(";");
    if (parts.length >= 2 && parts[1].trim() === 'rel="next"') {
      return parts[0].trim().slice(1, -1);
    }
  }

  return null;
}