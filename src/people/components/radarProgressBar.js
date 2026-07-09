export function renderRadarProgressBar(percent = null) {
  if (percent === null || percent === undefined) {
    return `<span class="cpt-radar-empty">—</span>`;
  }

  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));

  return `
    <div class="cpt-radar-progress">
      <div class="cpt-radar-progress-track">
        <div class="cpt-radar-progress-fill" style="width: ${safePercent}%"></div>
      </div>
      <span class="cpt-radar-progress-label">${safePercent}%</span>
    </div>
  `;
}