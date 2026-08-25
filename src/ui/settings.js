/*
 * Wayfinder - settings.js
 *
 * Purpose:
 * Renders the legacy Modules-page instructor Requirements panel used
 * to define custom required items for an individual Canvas module.
 *
 * The panel locates the requested module and its Canvas module items,
 * then determines which items should initially be selected.
 *
 * If the module has a saved custom rule, the saved requiredItemIds
 * are used. Otherwise, Wayfinder applies its keyword-based required
 * item detection to create the initial selection.
 *
 * The panel:
 *
 * - Displays every module item available to the legacy rule editor
 * - Creates a checkbox for selectable items
 * - Prevents Canvas text-header items from being selected
 * - Labels text headers as "Text Header - ignored"
 * - Provides a Save Custom Rules button
 * - Provides a Use Keyword Rules reset button
 * - Provides a Close button for the Requirements panel
 *
 * This file only generates the Requirements panel HTML. The functions
 * used to identify text headers, detect keyword matches, save/reset
 * rules, and bind the controls are supplied or handled elsewhere.
 *
 * This is separate from the newer People-page Required Items system
 * used by Student Radar and the published Wayfinder course
 * configuration.
 */

export function renderSettingsPanel({
  moduleId,
  data,
  rules,
  requiredKeywords,
  isTextHeaderItem,
  isRequiredTitle,
  cleanText,
  escapeHtml
}) {
  const module = data.modules.find((m) => String(m.id) === String(moduleId));
  if (!module) return "";

  const items = data.moduleItemsByModuleId[module.id] || [];
  const rule = rules[String(module.id)] || null;

  const selectedIds = new Set(
    rule && rule.mode === "custom"
      ? (rule.requiredItemIds || []).map(String)
      : items
          .filter((item) => !isTextHeaderItem(item) && isRequiredTitle(item.title, requiredKeywords))
          .map((item) => String(item.id))
  );

  const itemRows = items
    .map((item) => {
      const isHeader = isTextHeaderItem(item);
      const checked = selectedIds.has(String(item.id)) ? "checked" : "";
      const disabled = isHeader ? "disabled" : "";
      const labelSuffix = isHeader ? "Text Header - ignored" : item.type || "Item";

      return `
        <label class="cpt-rule-item ${isHeader ? "cpt-rule-disabled" : ""}">
          <input type="checkbox" class="cpt-rule-checkbox" value="${item.id}" ${checked} ${disabled}>
          <span>
            <strong>${escapeHtml(cleanText(item.title || "Untitled item"))}</strong>
            <small>${escapeHtml(labelSuffix)}</small>
          </span>
        </label>
      `;
    })
    .join("");

  return `
    <section class="cpt-settings-panel" data-module-id="${module.id}">
      <div class="cpt-settings-head">
        <div>
          <strong>Requirements</strong>
          <span>${escapeHtml(module.name)}</span>
        </div>
        <button class="cpt-close-settings" type="button">×</button>
      </div>
      <p>Select the items that count toward completion for this module.</p>
      <div class="cpt-rule-list">${itemRows}</div>
      <div class="cpt-settings-actions">
        <button class="cpt-save-rules" type="button" data-module-id="${module.id}">Save Custom Rules</button>
        <button class="cpt-reset-rules" type="button" data-module-id="${module.id}">Use Keyword Rules</button>
      </div>
    </section>
  `;
}
