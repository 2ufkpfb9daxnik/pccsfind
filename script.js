const field = document.querySelector("#map-field");
const brightnessAxis = document.querySelector(".brightness-axis");
const brightnessAxisLabel = document.querySelector(".axis-label-brightness");
const brightnessArrow = document.querySelector(".axis-arrow-brightness");
const colorForms = document.querySelectorAll(".color-form");
const colorList = document.querySelector("#color-list");
const hslDisplayFormat = document.querySelector("#hsl-display-format");
const coordinateControls = document.querySelector("#coordinate-controls");
const addCoordinateButton = document.querySelector("#add-coordinate");
const comparisonColors = [];
const tooltip = document.createElement("div");
tooltip.className = "color-tooltip";
document.body.append(tooltip);
const copyNotice = document.createElement("div");
copyNotice.className = "copy-notice";
document.body.append(copyNotice);
let copyNoticeTimer;
const coordinateOverlays = [];
const undoButton = document.querySelector("#undo-action");
const redoButton = document.querySelector("#redo-action");
const actionLog = document.querySelector("#action-log");
const history = [];
let historyIndex = -1;
let historyTimer;
let dragStartValues = null;

function getCoordinateEntries() {
  return [...coordinateControls.querySelectorAll(".coordinate-entry")];
}

function getCoordinateEntryIndex(entry) {
  return getCoordinateEntries().indexOf(entry);
}

function getCoordinateOverlay(entry) {
  return coordinateOverlays[getCoordinateEntryIndex(entry)];
}

function updatePinButton(button, isPinned) {
  button.classList.toggle("is-pinned", isPinned);
  button.textContent = isPinned ? "📌" : "○";
  button.setAttribute("aria-label", isPinned ? "ピン留めを解除" : "座標をピン留め");
  button.setAttribute("title", isPinned ? "ピン留めを解除" : "座標をピン留め");
}

function updateVisibilityButton(button, isVisible) {
  button.classList.toggle("is-hidden", !isVisible);
  button.textContent = isVisible ? "👁" : "◌";
  button.setAttribute("aria-label", isVisible ? "座標を非表示" : "座標を表示");
  button.setAttribute("title", isVisible ? "座標を非表示" : "座標を表示");
}

function syncCoordinateEntryControls(entry) {
  updatePinButton(
    entry.querySelector(".pin-coordinate"),
    entry.dataset.pinned === "true",
  );
  updateVisibilityButton(
    entry.querySelector(".visibility-coordinate"),
    entry.dataset.visible !== "false",
  );
}

function removeCoordinateOverlay(overlay) {
  Object.values(overlay).forEach((element) => element.remove());
}

function createComparisonColor(rgb) {
  return {
    value: `rgb(${rgb.join(", ")})`,
    rgb,
    coordinateIndex: null,
    openedRing: null,
    nearestRing: null,
    nearestSwatch: null,
    coordinateSample: null,
    originalX: null,
    originalY: null,
  };
}

function logAction(message) {
  const item = document.createElement("button");
  item.type = "button";
  item.textContent = message;
  item.historySnapshot = JSON.parse(JSON.stringify(getStateSnapshot()));
  item.title = "この時点の状態へ戻す";
  actionLog.append(item);
  while (actionLog.children.length > 5) actionLog.firstElementChild.remove();
}

actionLog.addEventListener("click", (event) => {
  const item = event.target.closest("button");
  if (!item || !actionLog.contains(item)) return;
  const snapshot = item.historySnapshot;
  if (!snapshot) return;
  const snapshotText = JSON.stringify(snapshot);
  let targetIndex = history.findIndex((state) => JSON.stringify(state) === snapshotText);
  if (targetIndex === -1) {
    history.splice(historyIndex + 1);
    history.push(snapshot);
    targetIndex = history.length - 1;
  }
  historyIndex = targetIndex;
  restoreState(snapshot);
  updateHistoryButtons();
  logAction("ログの時点へ移動しました");
});

function findNearestStandard(rgb) {
  let nearest = null;
  let nearestDistance = Infinity;
  rings.forEach((ring) => {
    ring.querySelectorAll("i").forEach((swatch) => {
      const distance = colorDistance(rgb, swatch.dataset.rgb.split(",").map(Number));
      if (distance < nearestDistance) {
        nearest = { ring, swatch, distance };
        nearestDistance = distance;
      }
    });
  });
  return nearest;
}

function getStateSnapshot() {
  return {
    comparisons: comparisonColors.map((comparison) => ({
      value: comparison.value,
      rgb: [...comparison.rgb],
      nearestRgb: comparison.nearestSwatch
        ? comparison.nearestSwatch.dataset.rgb.split(",").map(Number)
        : null,
      coordinateIndex: comparison.coordinateIndex ?? null,
      originalX: comparison.originalX ?? null,
      originalY: comparison.originalY ?? null,
    })),
    coordinates: getCoordinateEntries().map((entry, index) => ({
      format: entry.querySelector(".coordinate-format").value,
      saturation: entry.querySelector(".saturation-input").value,
      brightness: entry.querySelector(".brightness-input").value,
      pinned: entry.dataset.pinned === "true",
      visible: entry.dataset.visible !== "false",
      type: entry.dataset.coordinateType || "coordinate",
      comparisonId: entry.dataset.comparisonId ?? null,
      opened: !coordinateOverlays[index].openedRing.hidden,
    })),
  };
}

function updateHistoryButtons() {
  undoButton.disabled = historyIndex <= 0;
  redoButton.disabled = historyIndex >= history.length - 1;
}

function recordHistory() {
  const snapshot = getStateSnapshot();
  if (historyIndex >= 0
    && JSON.stringify(history[historyIndex]) === JSON.stringify(snapshot)) return;
  history.splice(historyIndex + 1);
  history.push(snapshot);
  historyIndex += 1;
  updateHistoryButtons();
}

function scheduleHistory() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(recordHistory, 250);
}

function clearCoordinates() {
  getCoordinateEntries().forEach((entry) => entry.remove());
  coordinateOverlays.splice(0).forEach(removeCoordinateOverlay);
}

function addComparisonSample(comparison, comparisonId, nearestRgb = null) {
  const group = document.createElement("span");
  group.className = "color-sample-group";
  group.dataset.comparisonId = String(comparisonId);

  const sample = document.createElement("span");
  sample.className = "color-sample";
  sample.dataset.comparisonId = String(comparisonId);
  sample.dataset.sampleType = "actual";
  sample.dataset.rgb = comparison.rgb.join(",");
  sample.dataset.tooltip = colorTooltip(comparison.rgb);
  sample.style.backgroundColor = comparison.value;
  group.append(sample);
  if (nearestRgb) {
    const standardSample = document.createElement("span");
    standardSample.className = "color-sample is-standard";
    standardSample.dataset.comparisonId = String(comparisonId);
    standardSample.dataset.sampleType = "standard";
    standardSample.dataset.rgb = nearestRgb.join(",");
    standardSample.dataset.tooltip = `最寄り標準色\n${colorTooltip(nearestRgb)}`;
    standardSample.style.backgroundColor = `rgb(${nearestRgb.join(", ")})`;
    group.append(standardSample);
  }
  const coordinateSample = document.createElement("span");
  coordinateSample.className = "color-sample is-coordinate";
  coordinateSample.dataset.comparisonId = String(comparisonId);
  coordinateSample.dataset.sampleType = "coordinate";
  coordinateSample.dataset.tooltip = "座標上の色";
  coordinateSample.style.backgroundColor = comparison.value;
  group.append(coordinateSample);
  colorList.append(group);
  comparison.coordinateSample = coordinateSample;
}

function updateComparisonCoordinateSample(entry) {
  const comparisonId = entry.dataset.comparisonId;
  if (comparisonId === undefined) return;
  const comparison = comparisonColors[Number(comparisonId)];
  if (!comparison?.coordinateSample) return;
  const format = entry.querySelector(".coordinate-format").value;
  const maximum = format === "255" ? 255 : 100;
  const saturation = Number(entry.querySelector(".saturation-input").value);
  const brightness = Number(entry.querySelector(".brightness-input").value);
  if (!Number.isFinite(saturation) || !Number.isFinite(brightness)) return;
  const [hue] = rgbToHsl(comparison.rgb);
  const rgb = hslToRgb(
    hue,
    (saturation / maximum) * 100,
    (brightness / maximum) * 100,
  );
  comparison.coordinateSample.dataset.rgb = rgb.join(",");
  comparison.coordinateSample.dataset.tooltip = `座標上の色\n${colorTooltip(rgb)}`;
  comparison.coordinateSample.style.backgroundColor = `rgb(${rgb.join(", ")})`;
}

function restoreCoordinates(coordinates) {
  coordinates.forEach((coordinate) => {
    const entry = addCoordinateEntry(
      coordinate.saturation,
      coordinate.brightness,
      coordinate.format,
    );
    entry.dataset.pinned = String(coordinate.pinned);
    entry.dataset.visible = String(coordinate.visible);
    entry.dataset.coordinateType = coordinate.type;
    if (coordinate.comparisonId !== null) {
      entry.dataset.comparisonId = coordinate.comparisonId;
    }
    syncCoordinateEntryControls(entry);
  });
}

function restoreComparisons(comparisons) {
  comparisons.forEach((comparison, comparisonId) => {
    const restored = {
      ...createComparisonColor([...comparison.rgb]),
      ...comparison,
      openedRing: null,
    };
    comparisonColors.push(restored);
    addComparisonSample(restored, comparisonId, comparison.nearestRgb);
  });
}

function restoreOpenedCoordinateRings(coordinates) {
  coordinates.forEach((coordinate, index) => {
    if (!coordinate.opened) return;
    const entry = getCoordinateEntries()[index];
    if (entry) openCoordinateEntry(entry);
  });
}

function linkComparisonOverlays(comparisons) {
  comparisons.forEach((comparison, comparisonId) => {
    const restored = comparisonColors[comparisonId];
    const overlay = coordinateOverlays[comparison.coordinateIndex];
    if (restored && overlay) restored.openedRing = overlay.openedRing;
  });
}

function clearStateForRestore() {
  clearCoordinates();
  comparisonColors.splice(0);
  colorList.replaceChildren();
}

function restoreState(snapshot) {
  clearStateForRestore();
  restoreCoordinates(snapshot.coordinates);
  restoreComparisons(snapshot.comparisons);
  updateCoordinateCrosshair();
  restoreOpenedCoordinateRings(snapshot.coordinates);
  linkComparisonOverlays(snapshot.comparisons);
  updateCoordinateCrosshair();
}

undoButton.addEventListener("click", () => {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreState(history[historyIndex]);
  updateHistoryButtons();
  logAction("1つ前の操作に戻しました");
});

redoButton.addEventListener("click", () => {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restoreState(history[historyIndex]);
  updateHistoryButtons();
  logAction("操作をやり直しました");
});

function createCoordinateOverlay() {
  const coordinateCrosshair = document.createElement("div");
  coordinateCrosshair.className = "coordinate-crosshair";
  coordinateCrosshair.innerHTML = '<span class="coordinate-line coordinate-line-horizontal"></span><span class="coordinate-line coordinate-line-vertical"></span><span class="coordinate-point"></span><span class="coordinate-value coordinate-value-saturation"></span><span class="coordinate-value coordinate-value-brightness"></span>';
  field.append(coordinateCrosshair);
  const nearestCrosshair = document.createElement("div");
  nearestCrosshair.className = "coordinate-crosshair coordinate-nearest";
  nearestCrosshair.innerHTML = '<span class="coordinate-line coordinate-line-horizontal"></span><span class="coordinate-line coordinate-line-vertical"></span><span class="coordinate-point"></span>';
  field.append(nearestCrosshair);
  const connector = document.createElement("span");
  connector.className = "coordinate-connector";
  field.append(connector);
  const openedRing = document.createElement("div");
  openedRing.className = "tone-ring opened-tone-ring";
  for (let index = 0; index < 12; index += 1) {
    const swatch = document.createElement("i");
    swatch.style.setProperty("--angle", `${index * 30 - 90}deg`);
    openedRing.append(swatch);
  }
  openedRing.hidden = true;
  field.append(openedRing);
  return { coordinateCrosshair, nearestCrosshair, connector, openedRing };
}

coordinateOverlays.push(createCoordinateOverlay());

const columns = [
  {
    saturation: 0,
    shape: "square",
    tones: ["W", "ltGy", "mGy", "dkGy", "Bk"],
    lightness: [95, 75, 50, 25, 5],
  },
  { saturation: 2, tones: ["p", "ltg", "g", "dkg"] },
  { saturation: 5, tones: ["lt", "sf", "d", "dk"] },
  { saturation: 8, tones: ["b", "s", "dp"] },
  { saturation: 9, tones: ["v"] },
];

const toneNames = {
  p: "ペール",
  ltg: "ライトグレイッシュ",
  g: "グレイッシュ",
  dkg: "ダークグレイッシュ",
  lt: "ライト",
  sf: "ソフト",
  d: "ダル",
  dk: "ダーク",
  b: "ブライト",
  s: "ストロング",
  dp: "ディープ",
  v: "ビビッド",
  W: "ホワイト",
  ltGy: "ライトグレイ",
  mGy: "ミディアムグレイ",
  dkGy: "ダークグレイ",
  Bk: "ブラック",
};

const toneDescriptions = {
  p: "薄い、淡い",
  ltg: "明るい灰みの、落ち着いた",
  g: "灰みの、地味な",
  dkg: "暗い灰みの、重い",
  lt: "浅い、明るい",
  sf: "柔らかい、穏やかな",
  d: "鈍い、くすんだ",
  dk: "暗い、大人っぽい",
  b: "明るい、華やかな",
  s: "強い、力強い",
  dp: "深い、濃い",
  v: "鮮やかな、冴えた",
  W: "白",
  ltGy: "明るい灰色",
  mGy: "灰色",
  dkGy: "暗い灰色",
  Bk: "黒",
};

function hslToRgb(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = hue / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] = sector < 1
    ? [chroma, second, 0]
    : sector < 2
      ? [second, chroma, 0]
      : sector < 3
        ? [0, chroma, second]
        : sector < 4
          ? [0, second, chroma]
          : sector < 5
            ? [second, 0, chroma]
            : [chroma, 0, second];
  const match = l - chroma / 2;

  return [red, green, blue].map((channel) => Math.round((channel + match) * 255));
}

function rgbToHsl([red, green, blue]) {
  const channels = [red, green, blue].map((channel) => channel / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const difference = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (difference !== 0) {
    saturation = difference / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case channels[0]:
        hue = ((channels[1] - channels[2]) / difference) % 6;
        break;
      case channels[1]:
        hue = (channels[2] - channels[0]) / difference + 2;
        break;
      default:
        hue = (channels[0] - channels[1]) / difference + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return [
    Math.round(hue),
    Math.round(saturation * 100),
    Math.round(lightness * 100),
  ];
}

function colorTooltip(rgb) {
  const [hue, saturation, lightness] = rgbToHsl(rgb);
  const hex = `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  const hsl = hslDisplayFormat.value === "255"
    ? `hsl(${hue}, ${Math.round((saturation / 100) * 255)}, ${Math.round((lightness / 100) * 255)})`
    : `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  return `${hsl}\n${hex}`;
}

function toneTooltip(tone, saturation, lightness) {
  const is255 = hslDisplayFormat.value === "255";
  const saturationValue = is255
    ? Math.round((saturation / 9) * 255)
    : Math.round((saturation / 9) * 100);
  const lightnessValue = is255
    ? Math.round((lightness / 100) * 255)
    : Math.round(lightness);
  const suffix = is255 ? "" : "%";
  return `${toneNames[tone]}\n${toneDescriptions[tone]}\n`
    + `彩度: ${saturationValue}${suffix}\n明度: ${lightnessValue}${suffix}`;
}

function rgbToHex(rgb) {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

async function copySwatchHex(swatch) {
  const hex = swatch.dataset.hex;
  try {
    await navigator.clipboard.writeText(hex);
    copyNotice.textContent = `${hex} をコピーしました`;
    copyNotice.classList.add("is-visible");
    clearTimeout(copyNoticeTimer);
    copyNoticeTimer = setTimeout(() => {
      copyNotice.classList.remove("is-visible");
    }, 2200);
  } catch (error) {
    console.error("色のコピーに失敗しました", error);
    copyNotice.textContent = `${hex} をコピーできませんでした`;
    copyNotice.classList.add("is-visible");
  }
}

function refreshTooltips() {
  field.querySelectorAll("i[data-rgb]").forEach((swatch) => {
    swatch.dataset.tooltip = colorTooltip(swatch.dataset.rgb.split(",").map(Number));
  });
  field.querySelectorAll(".tone-square[data-rgb]").forEach((square) => {
    square.dataset.tooltip = `${toneTooltip(
      square.dataset.tone,
      Number(square.dataset.saturation),
      Number(square.dataset.lightness),
    )}\n${colorTooltip(square.dataset.rgb.split(",").map(Number))}`;
  });
  field.querySelectorAll(".tone-ring[data-tone]").forEach((ring) => {
    if (ring.dataset.rgb) return;
    ring.dataset.tooltip = toneTooltip(
      ring.dataset.tone,
      Number(ring.dataset.saturation),
      Number(ring.dataset.lightness),
    );
  });
  colorList.querySelectorAll(".color-sample[data-rgb]").forEach((sample) => {
    sample.dataset.tooltip = colorTooltip(sample.dataset.rgb.split(",").map(Number));
  });
}

function showTooltip(target) {
  tooltip.textContent = target.dataset.tooltip;
  tooltip.classList.add("is-visible");
  const bounds = target.getBoundingClientRect();
  const tooltipBounds = tooltip.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(
    Math.max(margin, bounds.left + (bounds.width - tooltipBounds.width) / 2),
    window.innerWidth - tooltipBounds.width - margin,
  );
  const top = bounds.top - tooltipBounds.height - margin >= margin
    ? bounds.top - tooltipBounds.height - margin
    : bounds.bottom + margin;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.classList.remove("is-visible");
}

function getCoordinateValues(entry) {
  const coordinateFormat = entry.querySelector(".coordinate-format");
  const brightnessInput = entry.querySelector(".brightness-input");
  const saturationInput = entry.querySelector(".saturation-input");
  const brightness = Number(brightnessInput.value);
  const saturation = Number(saturationInput.value);
  const maximum = coordinateFormat.value === "255" ? 255 : 100;
  return {
    brightness,
    saturation,
    maximum,
    hasBrightness: brightnessInput.value !== ""
      && Number.isFinite(brightness)
      && brightness >= 0
      && brightness <= maximum,
    hasSaturation: saturationInput.value !== ""
      && Number.isFinite(saturation)
      && saturation >= 0
      && saturation <= maximum,
  };
}

function hideCoordinateOverlay(entry, overlay) {
  const { coordinateCrosshair, nearestCrosshair, connector, openedRing } = overlay;
  coordinateCrosshair.classList.remove("is-visible");
  nearestCrosshair.classList.remove("is-visible");
  connector.classList.remove("is-visible");
  entry.querySelector(".open-coordinate").disabled = true;
  entry.querySelector(".open-coordinate").textContent = "開";
  openedRing.hidden = true;
  coordinateCrosshair.querySelector(".coordinate-point").style.pointerEvents = "none";
}

function findNearestRing(circleCenters, x, y) {
  return circleCenters.reduce((closest, current) => {
    const distance = Math.hypot(current.x - x, current.y - y);
    return distance < closest.distance ? { ...current, distance } : closest;
  }, { ...circleCenters[0], distance: Infinity });
}

function getCoordinateTargetRing(entry, geometricNearest) {
  if (entry.dataset.coordinateType !== "color") return geometricNearest;
  const comparisonId = Number(entry.dataset.comparisonId);
  const comparison = comparisonColors[comparisonId];
  const standardRing = comparison?.nearestRing
    || (comparison ? findNearestStandard(comparison.rgb)?.ring : null);
  return standardRing
    ? {
      ring: standardRing,
      x: Number(standardRing.dataset.x),
      y: Number(standardRing.dataset.y),
      distance: 0,
    }
    : geometricNearest;
}

function updateCoordinateLabels(overlay, x, y, fieldBounds, axisBounds, values) {
  const crosshair = overlay.coordinateCrosshair;
  const saturationValue = crosshair.querySelector(".coordinate-value-saturation");
  const brightnessValue = crosshair.querySelector(".coordinate-value-brightness");
  saturationValue.style.left = `${fieldBounds.left + x}px`;
  saturationValue.style.top = `${axisBounds.saturation.top + 8}px`;
  brightnessValue.style.left = `${axisBounds.brightness.left - 8}px`;
  brightnessValue.style.top = `${fieldBounds.top + y}px`;
  saturationValue.style.display = values.hasSaturation ? "block" : "none";
  brightnessValue.style.display = values.hasBrightness ? "block" : "none";
  if (values.hasSaturation) {
    const percent = (values.saturation / values.maximum) * 100;
    const value255 = (values.saturation / values.maximum) * 255;
    saturationValue.textContent = `${Number(percent.toFixed(2))}% / ${Number(value255.toFixed(2))}`;
  }
  if (values.hasBrightness) {
    const percent = (values.brightness / values.maximum) * 100;
    const value255 = (values.brightness / values.maximum) * 255;
    brightnessValue.textContent = `${Number(percent.toFixed(2))}%\n${Number(value255.toFixed(2))}`;
  }
}

function updateNearestCoordinateOverlay(entry, overlay, nearest, x, y, geometry) {
  const { nearestCrosshair, connector } = overlay;
  const isComplete = geometry.hasBrightness && geometry.hasSaturation;
  const isColorCoordinate = entry.dataset.coordinateType === "color";
  nearestCrosshair.classList.toggle("coordinate-comparison", isColorCoordinate);
  nearestCrosshair.style.setProperty("--coordinate-axis-width", `${geometry.horizontalLineWidth}px`);
  nearestCrosshair.style.setProperty("--coordinate-axis-height", `${geometry.fieldHeight}px`);
  nearestCrosshair.style.left = `${isComplete ? nearest.x : 0}px`;
  nearestCrosshair.style.top = `${isComplete ? nearest.y : 0}px`;
  nearestCrosshair.classList.toggle("is-visible", isComplete);
  if (isComplete && !isColorCoordinate) {
    const connectorLength = Math.hypot(nearest.x - x, nearest.y - y);
    const connectorAngle = Math.atan2(nearest.y - y, nearest.x - x) * 180 / Math.PI;
    connector.style.left = `${x}px`;
    connector.style.top = `${y}px`;
    connector.style.width = `${connectorLength}px`;
    connector.style.transform = `rotate(${connectorAngle}deg)`;
    connector.classList.add("is-visible");
  } else {
    connector.classList.remove("is-visible");
  }
}

function updateCoordinatePosition(overlay, x, y, geometry) {
  const { coordinateCrosshair } = overlay;
  coordinateCrosshair.style.setProperty("--coordinate-axis-width", `${geometry.horizontalLineWidth}px`);
  coordinateCrosshair.style.setProperty("--coordinate-axis-height", `${geometry.fieldHeight}px`);
  coordinateCrosshair.style.left = `${x}px`;
  coordinateCrosshair.style.top = `${y}px`;
}

function updateCoordinateInteraction(entry, overlay, values) {
  const { coordinateCrosshair, openedRing } = overlay;
  const horizontalLine = coordinateCrosshair.querySelector(".coordinate-line-horizontal");
  const verticalLine = coordinateCrosshair.querySelector(".coordinate-line-vertical");
  const point = coordinateCrosshair.querySelector(".coordinate-point");
  const isComplete = values.hasBrightness && values.hasSaturation;
  horizontalLine.style.display = values.hasBrightness ? "block" : "none";
  verticalLine.style.display = values.hasSaturation ? "block" : "none";
  point.style.display = isComplete ? "block" : "none";
  point.style.pointerEvents = isComplete && entry.dataset.pinned !== "true" ? "auto" : "none";
  point.style.cursor = point.style.pointerEvents === "auto" ? "grab" : "default";
  entry.querySelector(".open-coordinate").disabled = !isComplete;
  if (!isComplete) openedRing.hidden = true;
}

function updateCoordinateOverlayVisibility(entry, overlay) {
  const isVisible = entry.dataset.visible !== "false";
  Object.values(overlay).forEach((overlayElement) => {
    overlayElement.classList.toggle("coordinate-is-hidden", !isVisible);
  });
  return isVisible;
}

function storeCoordinatePosition(entry, x, y, values) {
  entry.dataset.coordinateX = `${x}`;
  entry.dataset.coordinateY = `${y}`;
  entry.dataset.coordinateSaturation = `${values.saturation}`;
  entry.dataset.coordinateBrightness = `${values.brightness}`;
}

function updateCoordinateEntryOverlay(entry, overlay, layout) {
  const { coordinateCrosshair, openedRing } = overlay;
  const values = getCoordinateValues(entry);
  const { brightness, saturation, maximum, hasBrightness, hasSaturation } = values;
  updateCoordinateOverlayVisibility(entry, overlay);

  if (!hasBrightness && !hasSaturation) {
    hideCoordinateOverlay(entry, overlay);
    return;
  }

  const x = hasSaturation
    ? layout.squareRight + (saturation / maximum) * layout.axisWidth
    : 0;
  const y = hasBrightness
    ? (1 - brightness / maximum) * layout.fieldHeight
    : 0;
  storeCoordinatePosition(entry, x, y, values);
  updateComparisonCoordinateSample(entry);
  if (!openedRing.hidden) updateOpenedRing(entry, openedRing);
  updateCoordinateInteraction(entry, overlay, values);
  const nearest = getCoordinateTargetRing(
    entry,
    findNearestRing(layout.circleCenters, x, y),
  );
  updateCoordinatePosition(overlay, x, y, layout);
  updateCoordinateLabels(overlay, x, y, layout.fieldBounds, layout.axisBounds, values);
  updateNearestCoordinateOverlay(entry, overlay, nearest, x, y, {
    ...layout,
    hasBrightness,
    hasSaturation,
  });
  coordinateCrosshair.classList.add("is-visible");
}

function updateCoordinateCrosshair() {
  const fieldBounds = field.getBoundingClientRect();
  const mapBounds = field.parentElement.getBoundingClientRect();
  const brightnessAxisBounds = brightnessAxis.getBoundingClientRect();
  const saturationAxisBounds = document.querySelector(".saturation-axis").getBoundingClientRect();
  const square = rings.find((ring) => ring.classList.contains("tone-square"));
  const circleCenters = rings
    .filter((ring) => !ring.classList.contains("tone-square"))
    .map((ring) => ({
      ring,
      x: Number(ring.dataset.x),
      y: Number(ring.dataset.y),
    }));
  const squareRight = Number(square.dataset.x) + Number.parseFloat(getComputedStyle(field).getPropertyValue("--ring-size")) * 0.34;
  const rightmostCircle = circleCenters.reduce((rightmost, current) =>
    current.x > rightmost.x ? current : rightmost,
  );
  const axisWidth = rightmostCircle.x - squareRight;
  const horizontalLineWidth = mapBounds.right - fieldBounds.left
    + brightnessAxisBounds.left - fieldBounds.left;
  const axisBounds = {
    brightness: brightnessAxisBounds,
    saturation: saturationAxisBounds,
  };
  const geometry = {
    fieldHeight: fieldBounds.height,
    horizontalLineWidth,
  };
  const layout = {
    ...geometry,
    fieldBounds,
    axisBounds,
    circleCenters,
    squareRight,
    axisWidth,
  };

  getCoordinateEntries().forEach((entry, index) => {
    updateCoordinateEntryOverlay(entry, coordinateOverlays[index], layout);
  });
  updateHands();
}

function parseColor(value, format) {
  const normalized = value.trim().toLowerCase();
  const normalizeRgb = (channels) =>
    channels.every((channel) => channel >= 0 && channel <= 255)
      ? channels
      : null;
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  if (format === "hex" && /^(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/.test(hex)) {
    const expanded = hex.length === 3
      ? hex.split("").map((digit) => digit + digit).join("")
      : hex;
    return [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
    ];
  }

  if (format === "rgb") {
    const rgbMatch = normalized.match(/^(?:rgba?\(\s*)?([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)\s*\)?$/);
    if (rgbMatch) return normalizeRgb(rgbMatch.slice(1).map(Number));
  }

  const hslMatch = normalized.match(/^(?:hsla?\(\s*)?([\d.]+)(?:deg)?(?:\s*,\s*|\s+)([\d.]+)(%?)(?:\s*,\s*|\s+)([\d.]+)(%?)\s*\)?$/);
  if (hslMatch) {
    const rawHue = Number(hslMatch[1]);
    const saturation = Number(hslMatch[2]);
    const lightness = Number(hslMatch[4]);
    const isPercent = format === "hslPercent";
    if (!isPercent && (hslMatch[3] || hslMatch[5])) {
      return null;
    }
    if (
      rawHue > (isPercent ? 360 : 255)
      || saturation > (isPercent ? 100 : 255)
      || lightness > (isPercent ? 100 : 255)
    ) {
      return null;
    }

    return hslToRgb(
      isPercent ? rawHue : (rawHue / 255) * 360,
      isPercent ? saturation : (saturation / 255) * 100,
      isPercent ? lightness : (lightness / 255) * 100,
    );
  }

  return null;
}

function colorDistance(first, second) {
  return Math.hypot(
    first[0] - second[0],
    first[1] - second[1],
    first[2] - second[2],
  );
}

function createRing(saturation, tone, shape = "ring") {
  const ring = document.createElement("div");
  ring.className = `tone-ring tone-${shape}`;
  ring.dataset.tone = tone;
  ring.dataset.saturation = saturation;

  const swatchCount = shape === "square" ? 0 : 12;
  for (let index = 0; index < swatchCount; index += 1) {
    const swatch = document.createElement("i");
    const hue = index * 30;
    swatch.style.setProperty("--angle", `${hue - 90}deg`);
    swatch.dataset.hue = hue;
    ring.append(swatch);
  }

  const toneLabel = document.createElement("span");
  toneLabel.className = "tone-label";
  toneLabel.textContent = tone;
  ring.append(toneLabel);

  field.append(ring);
  return ring;
}

const rings = columns.flatMap(({ saturation, tones, shape }) =>
  tones.map((tone) => createRing(saturation, tone, shape)),
);

function getRingLayoutMetrics(width, height) {
  const colorColumns = columns.filter(({ shape }) => shape !== "square");
  const maxRows = Math.max(...colorColumns.map(({ tones }) => tones.length));
  const visualDiameterRatio = 1.26;
  const gapRatio = 1.04;
  const ringSize = Math.min(
    width / (visualDiameterRatio * (1 + (colorColumns.length - 1) * gapRatio)),
    height / (visualDiameterRatio * (1 + (maxRows - 1) * gapRatio)),
  );
  const visualRadius = ringSize * visualDiameterRatio / 2;
  const visualDiameter = visualRadius * 2;
  const columnGap = visualDiameter * gapRatio;
  const groupWidth = visualDiameter + columnGap * (colorColumns.length - 1);
  const rowGap = visualDiameter * gapRatio;
  const colorGroupHeight = visualDiameter + rowGap * (maxRows - 1);
  return {
    colorColumns,
    maxRows,
    ringSize,
    visualRadius,
    visualDiameter,
    columnGap,
    groupWidth,
    rowGap,
    colorGroupHeight,
  };
}

function updateRingAxisLayout(width, metrics) {
  const { visualRadius, ringSize, groupWidth } = metrics;
  const fieldBounds = field.getBoundingClientRect();
  const mapBounds = field.parentElement.getBoundingClientRect();
  const groupStart = Math.max(
    metrics.visualRadius,
    (width - groupWidth) / 2 + visualRadius + metrics.visualDiameter,
  );
  const brightnessAxisLeft = fieldBounds.left - mapBounds.left
    + groupStart - visualRadius - ringSize * 0.68 - 42;

  field.style.setProperty("--ring-size", `${ringSize}px`);
  field.style.setProperty("--ring-radius", `${ringSize * 0.43}px`);
  brightnessAxis.style.left = `${brightnessAxisLeft}px`;
  brightnessAxisLabel.style.left = `${brightnessAxisLeft - 20}px`;
  brightnessArrow.style.left = `${brightnessAxisLeft + 7}px`;
  return groupStart;
}

function updateRingColumn(column, ringIndex, columnIndex, groupStart, groupStartY, metrics, height) {
  const {
    colorColumns, visualRadius, visualDiameter, columnGap, rowGap, colorGroupHeight,
  } = metrics;
  const { saturation, tones, shape, lightness: toneLightness } = column;
  const count = tones.length;
  const colorColumnIndex = shape === "square"
    ? -1
    : colorColumns.findIndex(({ tones: colorTones }) => colorTones === tones);
  const columnX = shape === "square"
    ? groupStart - visualRadius - metrics.ringSize * 0.34 - 28
    : groupStart + columnGap * colorColumnIndex;
  const columnGroupHeight = shape === "square"
    ? colorGroupHeight
    : visualDiameter + rowGap * (count - 1);
  const columnStartY = shape === "square"
    ? groupStartY
    : (height - columnGroupHeight) / 2 + visualRadius;
  const columnRowGap = count === 1
    ? 0
    : (columnGroupHeight - visualDiameter) / (count - 1);

  for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
    const ring = rings[ringIndex + rowIndex];
    const centerY = count === 1
      ? columnStartY + (columnGroupHeight - visualDiameter) / 2
      : columnStartY + columnRowGap * rowIndex;
    const lightness = toneLightness
      ? toneLightness[rowIndex]
      : Math.round(92 - (centerY / height) * 78);
    updateRingDisplay(ring, column, columnX, centerY, lightness);
  }
}

function updateRingDisplay(ring, column, columnX, centerY, lightness) {
  const { saturation, shape } = column;
  ring.style.left = `${columnX}px`;
  ring.style.top = `${centerY}px`;
  ring.dataset.x = columnX;
  ring.dataset.y = centerY;
  ring.dataset.lightness = lightness;
  ring.dataset.tooltip = toneTooltip(
    ring.dataset.tone,
    Number(ring.dataset.saturation),
    lightness,
  );
  if (shape === "square") {
    const squareRgb = [lightness * 2.55, lightness * 2.55, lightness * 2.55].map(Math.round);
    ring.dataset.rgb = squareRgb.join(",");
    ring.dataset.tooltip += `\n${colorTooltip(squareRgb)}`;
    ring.style.setProperty("--square-color", `rgb(${squareRgb.join(" ")})`);
  }
  ring.querySelectorAll("i").forEach((swatch, index) => {
    const rgb = shape === "square"
      ? [lightness * 2.55, lightness * 2.55, lightness * 2.55].map(Math.round)
      : hslToRgb(index * 30, (saturation / 9) * 100, lightness);
    swatch.dataset.rgb = rgb.join(",");
    swatch.dataset.hex = rgbToHex(rgb);
    swatch.dataset.tooltip = colorTooltip(rgb);
    swatch.style.backgroundColor = `rgb(${rgb.join(" ")})`;
  });
}

function layoutRings() {
  const { width, height } = field.getBoundingClientRect();
  const metrics = getRingLayoutMetrics(width, height);
  const groupStart = updateRingAxisLayout(width, metrics);
  const groupStartY = (height - metrics.colorGroupHeight) / 2 + metrics.visualRadius;
  let ringIndex = 0;
  columns.forEach((column, columnIndex) => {
    updateRingColumn(column, ringIndex, columnIndex, groupStart, groupStartY, metrics, height);
    ringIndex += column.tones.length;
  });

  updateCoordinateCrosshair();
  updateHands();
}

function updateHands() {
  field.querySelectorAll(".color-hand").forEach((hand) => hand.remove());
  field.querySelectorAll(".comparison-ring-connector").forEach((connector) => connector.remove());
  comparisonColors.forEach((comparison, comparisonIndex) => {
    const nearest = findNearestStandard(comparison.rgb);
    if (!nearest) return;
    comparison.nearestRing = nearest.ring;
    comparison.nearestSwatch = nearest.swatch;

    const openedRing = comparison.openedRing;
    if (!openedRing || openedRing.hidden) return;
    const coordinateEntry = getComparisonCoordinateEntry(comparison, comparisonIndex);
    if (coordinateEntry?.dataset.visible === "false") return;
    renderComparisonHands(comparison, comparisonIndex, openedRing);
  });
}

function getComparisonCoordinateEntry(comparison, comparisonIndex) {
  const coordinateEntry = coordinateControls.querySelector(
    `.coordinate-entry[data-comparison-id="${comparisonIndex}"]`,
  );
  return coordinateEntry || getCoordinateEntries()[comparison.coordinateIndex];
}

function renderComparisonHands(comparison, comparisonIndex, openedRing) {
  const [inputHue] = rgbToHsl(comparison.rgb);
  const standardRing = comparison.nearestRing;
  const standardSwatch = comparison.nearestSwatch;
  field.append(createColorHand({
    type: "standard",
    comparisonIndex,
    x: standardRing.dataset.x,
    y: standardRing.dataset.y,
    angle: Number(standardSwatch.dataset.hue),
    tooltip: `最寄り標準色\n${colorTooltip(standardSwatch.dataset.rgb.split(",").map(Number))}`,
  }));
  field.append(createColorHand({
    type: "actual",
    comparisonIndex,
    x: openedRing.style.left,
    y: openedRing.style.top,
    angle: inputHue,
    tooltip: `入力色の色相\n${inputHue}°`,
  }));

  if (comparison.originalX !== null && comparison.originalY !== null) {
    field.append(createColorHand({
      type: "original",
      comparisonIndex,
      x: comparison.originalX,
      y: comparison.originalY,
      angle: inputHue,
    }));
  }

  const openedX = Number(openedRing.dataset.x);
  const openedY = Number(openedRing.dataset.y);
  const standardX = Number(standardRing.dataset.x);
  const standardY = Number(standardRing.dataset.y);
  field.append(createComparisonRingConnector(
    comparisonIndex,
    openedX,
    openedY,
    standardX,
    standardY,
  ));
}

function createColorHand({ type, comparisonIndex, x, y, angle, tooltip }) {
  const hand = document.createElement("div");
  hand.className = `color-hand color-hand-${type}`;
  hand.dataset.comparisonId = String(comparisonIndex);
  if (tooltip) hand.dataset.tooltip = tooltip;
  hand.style.left = `${x}px`;
  hand.style.top = `${y}px`;
  hand.style.setProperty("--hand-angle", `${angle - 90}deg`);
  return hand;
}

function createComparisonRingConnector(comparisonIndex, startX, startY, endX, endY) {
  const connector = document.createElement("span");
  const length = Math.hypot(endX - startX, endY - startY);
  const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
  connector.className = "comparison-ring-connector";
  connector.style.left = `${startX}px`;
  connector.style.top = `${startY}px`;
  connector.style.width = `${length}px`;
  connector.style.transform = `rotate(${angle}deg)`;
  connector.dataset.comparisonId = String(comparisonIndex);
  return connector;
}

function handleColorSubmit(event) {
  event.preventDefault();
  const colorForm = event.currentTarget;
  const colorInput = colorForm.querySelector("input");
  const rgb = parseColor(colorInput.value, colorForm.dataset.format);
  if (!rgb) {
    colorInput.setCustomValidity("正しい形式で入力してください");
    colorInput.reportValidity();
    return;
  }
  colorInput.setCustomValidity("");
  const comparisonId = comparisonColors.length;
  const comparison = createComparisonColor(rgb);
  const nearest = findNearestStandard(rgb);
  comparison.nearestRing = nearest?.ring ?? null;
  comparison.nearestSwatch = nearest?.swatch ?? null;
  comparisonColors.push(comparison);
  addComparisonSample(
    comparison,
    comparisonId,
    nearest ? nearest.swatch.dataset.rgb.split(",").map(Number) : null,
  );
  colorInput.value = "";
  const [, saturation, brightness] = rgbToHsl(rgb);
  const entry = addCoordinateAtValues(saturation, brightness);
  if (entry) {
    comparison.coordinateIndex = getCoordinateEntryIndex(entry);
    entry.dataset.comparisonId = String(comparisonId);
    updateCoordinateCrosshair();
    updateComparisonCoordinateSample(entry);
    openCoordinateEntry(entry);
    const index = getCoordinateEntryIndex(entry);
    comparison.openedRing = coordinateOverlays[index].openedRing;
    comparison.originalX = Number(comparison.openedRing.dataset.x);
    comparison.originalY = Number(comparison.openedRing.dataset.y);
  }
  updateHands();
  logAction(`色 ${rgbToHex(rgb)} を追加しました`);
  recordHistory();
}

function handleCoordinateChange() {
  updateCoordinateCrosshair();
  scheduleHistory();
}

function handleCoordinateInput() {
  updateCoordinateCrosshair();
}

colorForms.forEach((colorForm) => colorForm.addEventListener("submit", handleColorSubmit));

function addCoordinateEntry(saturationValue = "", brightnessValue = "", format = "percent") {
  const firstEntry = coordinateControls.querySelector(".coordinate-entry");
  const entry = firstEntry
    ? firstEntry.cloneNode(true)
    : document.createElement("div");
  if (!firstEntry) {
    entry.className = "coordinate-entry";
    entry.innerHTML = `
      <select class="coordinate-format" aria-label="座標入力形式">
        <option value="percent">座標 %</option>
        <option value="255">座標 0〜255</option>
      </select>
      <input class="saturation-input" type="number" min="0" placeholder="彩度" aria-label="彩度" />
      <input class="brightness-input" type="number" min="0" placeholder="明度" aria-label="明度" />
      <button class="open-coordinate" type="button" aria-label="指定座標を開く">開</button>
      <button class="pin-coordinate" type="button" aria-label="座標をピン留め" title="座標をピン留め">○</button>
      <button class="visibility-coordinate" type="button" aria-label="座標を非表示" title="座標を非表示">👁</button>
      <button class="remove-coordinate" type="button" aria-label="座標を削除">−</button>
    `;
  }
  entry.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });
  entry.querySelector(".coordinate-format").value = format;
  entry.querySelector(".saturation-input").value = saturationValue;
  entry.querySelector(".brightness-input").value = brightnessValue;
  entry.querySelector(".open-coordinate").textContent = "開く";
  entry.querySelector(".open-coordinate").disabled = true;
  entry.dataset.pinned = "false";
  entry.dataset.visible = "true";
  entry.dataset.coordinateType = "coordinate";
  syncCoordinateEntryControls(entry);
  coordinateControls.insertBefore(entry, addCoordinateButton);
  coordinateOverlays.push(createCoordinateOverlay());
  updateCoordinateCrosshair();
  entry.querySelector(".saturation-input").focus();
  return entry;
}

function addCoordinateAtValues(saturation, brightness) {
  const emptyEntry = getCoordinateEntries()
    .find((entry) =>
      entry.querySelector(".saturation-input").value === ""
      && entry.querySelector(".brightness-input").value === "");
  if (emptyEntry) {
    emptyEntry.dataset.coordinateType = "color";
    emptyEntry.querySelector(".coordinate-format").value = "percent";
    emptyEntry.querySelector(".saturation-input").value = Number(saturation.toFixed(2));
    emptyEntry.querySelector(".brightness-input").value = Number(brightness.toFixed(2));
    updateCoordinateCrosshair();
    return emptyEntry;
  }
  const entry = addCoordinateEntry(Number(saturation.toFixed(2)), Number(brightness.toFixed(2)));
  entry.dataset.coordinateType = "color";
  return entry;
}

function updateOpenedRing(entry, openedRing) {
  const coordinateFormat = entry.querySelector(".coordinate-format");
  const maximum = coordinateFormat.value === "255" ? 255 : 100;
  const saturation = Number(entry.dataset.coordinateSaturation);
  const brightness = Number(entry.dataset.coordinateBrightness);
  openedRing.style.left = `${entry.dataset.coordinateX}px`;
  openedRing.style.top = `${entry.dataset.coordinateY}px`;
  openedRing.dataset.x = entry.dataset.coordinateX;
  openedRing.dataset.y = entry.dataset.coordinateY;
  openedRing.style.setProperty("--opened-ring-saturation", `${(saturation / maximum) * 100 / 9}%`);
  openedRing.style.setProperty("--opened-ring-lightness", `${(brightness / maximum) * 100}%`);
  openedRing.querySelectorAll("i").forEach((swatch, swatchIndex) => {
    const rgb = hslToRgb(
      swatchIndex * 30,
      (saturation / maximum) * 100,
      (brightness / maximum) * 100,
    );
    swatch.dataset.rgb = rgb.join(",");
    swatch.dataset.hex = rgbToHex(rgb);
    swatch.dataset.hue = `${swatchIndex * 30}`;
    swatch.dataset.tooltip = colorTooltip(rgb);
    swatch.style.backgroundColor = `rgb(${rgb.join(" ")})`;
  });
}

function openCoordinateEntry(entry) {
  const overlay = getCoordinateOverlay(entry);
  if (!overlay || overlay.openedRing.hidden === false) return;
  updateOpenedRing(entry, overlay.openedRing);
  overlay.openedRing.hidden = false;
  entry.querySelector(".open-coordinate").textContent = "閉";
}

function refreshCoordinateView() {
  updateCoordinateCrosshair();
  updateHands();
}

function removeCoordinateEntry(entry) {
  const index = getCoordinateEntryIndex(entry);
  if (index < 0) return;
  entry.remove();
  removeCoordinateOverlay(coordinateOverlays.splice(index, 1)[0]);
  refreshCoordinateView();
  logAction("座標を削除しました");
  recordHistory();
}

function toggleCoordinateRing(entry) {
  const overlay = getCoordinateOverlay(entry);
  if (!overlay) return;
  const openButton = entry.querySelector(".open-coordinate");
  if (overlay.openedRing.hidden) {
    openCoordinateEntry(entry);
  } else {
    overlay.openedRing.hidden = true;
    openButton.textContent = "開く";
  }
  refreshCoordinateView();
  recordHistory();
}

function toggleCoordinateVisibility(entry, button) {
  const isVisible = entry.dataset.visible !== "false";
  entry.dataset.visible = String(!isVisible);
  updateVisibilityButton(button, !isVisible);
  refreshCoordinateView();
  recordHistory();
}

function toggleCoordinatePin(entry, button) {
  const isPinned = entry.dataset.pinned === "true";
  entry.dataset.pinned = String(!isPinned);
  updatePinButton(button, !isPinned);
  updateCoordinateCrosshair();
  recordHistory();
}

function handleCoordinateControlClick(event) {
  const removeButton = event.target.closest(".remove-coordinate");
  if (removeButton) {
    removeCoordinateEntry(removeButton.closest(".coordinate-entry"));
    return;
  }

  const openButton = event.target.closest(".open-coordinate");
  if (openButton && !openButton.disabled) {
    toggleCoordinateRing(openButton.closest(".coordinate-entry"));
    return;
  }

  const visibilityButton = event.target.closest(".visibility-coordinate");
  if (visibilityButton) {
    toggleCoordinateVisibility(visibilityButton.closest(".coordinate-entry"), visibilityButton);
    return;
  }

  const pinButton = event.target.closest(".pin-coordinate");
  if (pinButton) {
    toggleCoordinatePin(pinButton.closest(".coordinate-entry"), pinButton);
  }
}

function handleAddCoordinateClick() {
  addCoordinateEntry();
  logAction("座標入力欄を追加しました");
  recordHistory();
}

function handleCoordinateKeydown(event) {
  if (event.key === "Enter" && event.target.matches("input")) {
    event.preventDefault();
    addCoordinateEntry();
  }
}

let coordinateDrag = null;
function handleCoordinatePointerdown(event) {
  const point = event.target.closest(".coordinate-point");
  if (!point) return;
  const index = coordinateOverlays.findIndex((overlay) =>
    overlay.coordinateCrosshair.contains(point));
  const entry = getCoordinateEntries()[index];
  if (!entry || entry.dataset.pinned === "true"
  ) return;
  dragStartValues = {
    saturation: entry.querySelector(".saturation-input").value,
    brightness: entry.querySelector(".brightness-input").value,
  };
  coordinateDrag = { index, pointerId: event.pointerId };
  field.setPointerCapture(event.pointerId);
  point.style.cursor = "grabbing";
  event.preventDefault();
}

function handleCoordinatePointermove(event) {
  if (!coordinateDrag || coordinateDrag.pointerId !== event.pointerId) return;
  const entry = getCoordinateEntries()[coordinateDrag.index];
  if (!entry) return;
  const fieldBounds = field.getBoundingClientRect();
  const square = rings.find((ring) => ring.classList.contains("tone-square"));
  const squareRight = Number(square.dataset.x)
    + Number.parseFloat(getComputedStyle(field).getPropertyValue("--ring-size")) * 0.34;
  const rightmostCircle = rings
    .filter((ring) => !ring.classList.contains("tone-square"))
    .reduce((rightmost, ring) =>
      Number(ring.dataset.x) > Number(rightmost.dataset.x) ? ring : rightmost);
  const axisWidth = Number(rightmostCircle.dataset.x) - squareRight;
  const maximum = entry.querySelector(".coordinate-format").value === "255" ? 255 : 100;
  const x = Math.max(squareRight, Math.min(Number(rightmostCircle.dataset.x),
    event.clientX - fieldBounds.left));
  const y = Math.max(0, Math.min(fieldBounds.height, event.clientY - fieldBounds.top));
  entry.querySelector(".saturation-input").value =
    (((x - squareRight) / axisWidth) * maximum).toFixed(2);
  entry.querySelector(".brightness-input").value =
    ((1 - y / fieldBounds.height) * maximum).toFixed(2);
  updateCoordinateCrosshair();
  updateHands();
  event.preventDefault();
}

function stopCoordinateDrag(event) {
  if (coordinateDrag && coordinateDrag.pointerId === event.pointerId) {
    const entry = getCoordinateEntries()[coordinateDrag.index];
    coordinateDrag = null;
    if (entry && dragStartValues
      && (dragStartValues.saturation !== entry.querySelector(".saturation-input").value
        || dragStartValues.brightness !== entry.querySelector(".brightness-input").value)) {
      logAction(
        `座標を 彩度${dragStartValues.saturation || "-"} 明度${dragStartValues.brightness || "-"} `
        + `から 彩度${entry.querySelector(".saturation-input").value} 明度${entry.querySelector(".brightness-input").value} へ移動しました`,
      );
      recordHistory();
    }
    dragStartValues = null;
  }
}

function handleTooltipPointerover(event) {
    const target = event.target.closest("[data-tooltip]");
    if (target && event.currentTarget.contains(target)) showTooltip(target);
}

function handleTooltipPointerout(event) {
    const target = event.target.closest("[data-tooltip]");
    if (!target || target.contains(event.relatedTarget)) return;
    hideTooltip();
}

function handleSwatchClick(event) {
  const swatch = event.target.closest(".tone-ring i");
  if (swatch) copySwatchHex(swatch);
}

function handleColorSamplePointerover(event) {
  const sample = event.target.closest(".color-sample");
  if (!sample) return;
  const handType = sample.dataset.sampleType === "standard" ? "standard" : "actual";
  field.querySelector(`.color-hand-${handType}[data-comparison-id="${sample.dataset.comparisonId}"]`)
    ?.classList.add("is-hovered");
  if (sample.dataset.sampleType === "actual") {
    field.querySelector(`.color-hand-original[data-comparison-id="${sample.dataset.comparisonId}"]`)
      ?.classList.add("is-original-visible");
  }
}

function handleColorSamplePointerout(event) {
  const sample = event.target.closest(".color-sample");
  if (!sample || sample.contains(event.relatedTarget)) return;
  const handType = sample.dataset.sampleType === "standard" ? "standard" : "actual";
  field.querySelector(`.color-hand-${handType}[data-comparison-id="${sample.dataset.comparisonId}"]`)
    ?.classList.remove("is-hovered");
  if (sample.dataset.sampleType === "actual") {
    field.querySelector(`.color-hand-original[data-comparison-id="${sample.dataset.comparisonId}"]`)
      ?.classList.remove("is-original-visible");
  }
}

function bindColorInputEvents() {
  colorForms.forEach((colorForm) => colorForm.addEventListener("submit", handleColorSubmit));
  hslDisplayFormat.addEventListener("change", refreshTooltips);
}

function bindCoordinateEvents() {
  coordinateControls.addEventListener("input", handleCoordinateInput);
  coordinateControls.addEventListener("change", handleCoordinateChange);
  coordinateControls.addEventListener("click", handleCoordinateControlClick);
  coordinateControls.addEventListener("keydown", handleCoordinateKeydown);
  addCoordinateButton.addEventListener("click", handleAddCoordinateClick);
  field.addEventListener("pointerdown", handleCoordinatePointerdown);
  field.addEventListener("pointermove", handleCoordinatePointermove);
  field.addEventListener("pointerup", stopCoordinateDrag);
  field.addEventListener("pointercancel", stopCoordinateDrag);
}

function bindDisplayEvents() {
  for (const container of [field, colorList]) {
    container.addEventListener("pointerover", handleTooltipPointerover);
    container.addEventListener("pointerout", handleTooltipPointerout);
  }
  field.addEventListener("click", handleSwatchClick);
  colorList.addEventListener("pointerover", handleColorSamplePointerover);
  colorList.addEventListener("pointerout", handleColorSamplePointerout);
}

bindColorInputEvents();
bindCoordinateEvents();
bindDisplayEvents();
new ResizeObserver(layoutRings).observe(field);
layoutRings();
recordHistory();
