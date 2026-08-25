/*
 * Wayfinder - radarTooltips.js
 *
 * Purpose:
 * Implements the shared tooltip behavior for Student Radar progress
 * bars and summary cards.
 *
 * The module detects tooltip-enabled Radar elements and copies their
 * hidden tooltip content into a single portal element appended directly
 * to document.body.
 *
 * Using a body-level portal prevents Canvas or Wayfinder overflow
 * containers from clipping the visible tooltip.
 *
 * The tooltip system calculates placement above or below the target,
 * keeps the tooltip within the browser viewport, and positions the
 * tooltip arrow toward the center of the triggering element.
 *
 * Tooltips can be opened through mouse hover or keyboard focus and can
 * be dismissed through mouse/focus changes or the Escape key.
 *
 * Positioning is recalculated during scrolling and window resizing.
 * initializeRadarTooltips() also cleans up previous event bindings
 * before attaching a new set of listeners.
 */


const TOOLTIP_TARGET_SELECTOR = [
  ".cpt-radar-progress-wrapper",
  ".cpt-radar-summary-card"
].join(", ");

const TOOLTIP_SOURCE_SELECTOR = [
  ".cpt-radar-progress-tooltip",
  ".cpt-radar-summary-tooltip"
].join(", ");

const PORTAL_ID = "cpt-radar-tooltip-portal";
const VIEWPORT_PADDING = 10;
const TARGET_GAP = 7;

let activeTarget = null;
let portal = null;
let cleanupCurrentBinding = null;

function getTooltipSource(target) {
  return target?.querySelector(
    TOOLTIP_SOURCE_SELECTOR
  );
}

function getOrCreatePortal() {
  let existingPortal = document.getElementById(
    PORTAL_ID
  );

  if (existingPortal) {
    return existingPortal;
  }

  existingPortal = document.createElement("div");
  existingPortal.id = PORTAL_ID;
  existingPortal.className =
    "cpt-radar-tooltip-portal";
  existingPortal.setAttribute("role", "tooltip");
  existingPortal.hidden = true;

  document.body.appendChild(existingPortal);

  return existingPortal;
}

function clamp(value, minimum, maximum) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  );
}

function positionPortal() {
  if (
    !activeTarget ||
    !portal ||
    portal.hidden
  ) {
    return;
  }

  const targetRect =
    activeTarget.getBoundingClientRect();

  const tooltipRect =
    portal.getBoundingClientRect();

  const viewportWidth =
    document.documentElement.clientWidth;

  const viewportHeight =
    document.documentElement.clientHeight;

  /*
   * Center the tooltip horizontally on its target,
   * then keep it inside the browser viewport.
   */
  let left =
    targetRect.left +
    targetRect.width / 2 -
    tooltipRect.width / 2;

  left = clamp(
    left,
    VIEWPORT_PADDING,
    viewportWidth -
      tooltipRect.width -
      VIEWPORT_PADDING
  );

  const spaceAbove =
    targetRect.top - VIEWPORT_PADDING;

  const spaceBelow =
    viewportHeight -
    targetRect.bottom -
    VIEWPORT_PADDING;

  const fitsAbove =
    spaceAbove >=
    tooltipRect.height + TARGET_GAP;

  const fitsBelow =
    spaceBelow >=
    tooltipRect.height + TARGET_GAP;

  let placement = "above";
  let top;

  if (fitsAbove) {
    top =
      targetRect.top -
      tooltipRect.height -
      TARGET_GAP;
  } else if (fitsBelow) {
    placement = "below";
    top = targetRect.bottom + TARGET_GAP;
  } else if (spaceBelow >= spaceAbove) {
    /*
     * If neither direction has enough space, use the
     * side with more room and keep the tooltip inside
     * the viewport.
     */
    placement = "below";
    top = clamp(
      targetRect.bottom + TARGET_GAP,
      VIEWPORT_PADDING,
      viewportHeight -
        tooltipRect.height -
        VIEWPORT_PADDING
    );
  } else {
    top = clamp(
      targetRect.top -
        tooltipRect.height -
        TARGET_GAP,
      VIEWPORT_PADDING,
      viewportHeight -
        tooltipRect.height -
        VIEWPORT_PADDING
    );
  }

  portal.dataset.placement = placement;
  portal.style.left = `${Math.round(left)}px`;
  portal.style.top = `${Math.round(top)}px`;

  /*
   * Position the arrow toward the center of the target,
   * while keeping it away from the tooltip's corners.
   */
  const targetCenter =
    targetRect.left + targetRect.width / 2;

  const arrowLeft = clamp(
    targetCenter - left,
    12,
    tooltipRect.width - 12
  );

  portal.style.setProperty(
    "--cpt-tooltip-arrow-left",
    `${Math.round(arrowLeft)}px`
  );
}

function showTooltip(target) {
  const source = getTooltipSource(target);

  if (!source) {
    return;
  }

  activeTarget = target;
  portal = getOrCreatePortal();

  /*
   * Copy only the tooltip's contents. The visible copy
   * is placed directly under document.body so Canvas
   * and Wayfinder overflow containers cannot clip it.
   */
  portal.innerHTML = source.innerHTML;
  portal.hidden = false;
  portal.dataset.visible = "true";

  /*
   * Wait until the browser has measured the copied
   * tooltip before calculating its final position.
   */
  requestAnimationFrame(positionPortal);
}

function hideTooltip(target = null) {
  /*
   * Ignore stale leave events from a target that is no
   * longer the active tooltip target.
   */
  if (
    target &&
    activeTarget &&
    target !== activeTarget
  ) {
    return;
  }

  activeTarget = null;

  if (!portal) {
    return;
  }

  portal.hidden = true;
  portal.dataset.visible = "false";
  portal.innerHTML = "";
}

function findTargetFromEvent(event) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest(
    TOOLTIP_TARGET_SELECTOR
  );
}

function handleMouseOver(event) {
  const target = findTargetFromEvent(event);

  if (!target) {
    return;
  }

  /*
   * mouseover bubbles. Ignore movement between child
   * elements inside the same progress bar or card.
   */
  if (
    event.relatedTarget instanceof Node &&
    target.contains(event.relatedTarget)
  ) {
    return;
  }

  showTooltip(target);
}

function handleMouseOut(event) {
  const target = findTargetFromEvent(event);

  if (!target) {
    return;
  }

  if (
    event.relatedTarget instanceof Node &&
    target.contains(event.relatedTarget)
  ) {
    return;
  }

  hideTooltip(target);
}

function handleFocusIn(event) {
  const target = findTargetFromEvent(event);

  if (target) {
    showTooltip(target);
  }
}

function handleFocusOut(event) {
  const target = findTargetFromEvent(event);

  if (!target) {
    return;
  }

  if (
    event.relatedTarget instanceof Node &&
    target.contains(event.relatedTarget)
  ) {
    return;
  }

  hideTooltip(target);
}

function handleEscape(event) {
  if (event.key === "Escape") {
    hideTooltip();
  }
}

function handleViewportChange() {
  if (activeTarget) {
    requestAnimationFrame(positionPortal);
  }
}

export function initializeRadarTooltips(panel) {
  /*
   * Prevent duplicate listeners if Student Radar
   * recalculates and initializes again.
   */
  cleanupCurrentBinding?.();

  if (!(panel instanceof Element)) {
    return () => {};
  }

  portal = getOrCreatePortal();

  panel.addEventListener(
    "mouseover",
    handleMouseOver
  );

  panel.addEventListener(
    "mouseout",
    handleMouseOut
  );

  panel.addEventListener(
    "focusin",
    handleFocusIn
  );

  panel.addEventListener(
    "focusout",
    handleFocusOut
  );

  document.addEventListener(
    "keydown",
    handleEscape
  );

  window.addEventListener(
    "resize",
    handleViewportChange
  );

  /*
   * Capture scroll events from the Canvas page,
   * Wayfinder panel, and Student Radar table.
   */
  document.addEventListener(
    "scroll",
    handleViewportChange,
    true
  );

  cleanupCurrentBinding = () => {
    panel.removeEventListener(
      "mouseover",
      handleMouseOver
    );

    panel.removeEventListener(
      "mouseout",
      handleMouseOut
    );

    panel.removeEventListener(
      "focusin",
      handleFocusIn
    );

    panel.removeEventListener(
      "focusout",
      handleFocusOut
    );

    document.removeEventListener(
      "keydown",
      handleEscape
    );

    window.removeEventListener(
      "resize",
      handleViewportChange
    );

    document.removeEventListener(
      "scroll",
      handleViewportChange,
      true
    );

    hideTooltip();

    cleanupCurrentBinding = null;
  };

  return cleanupCurrentBinding;
}