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
    coordinates: [...coordinateControls.querySelectorAll(".coordinate-entry")].map((entry) => ({
      format: entry.querySelector(".coordinate-format").value,
      saturation: entry.querySelector(".saturation-input").value,
      brightness: entry.querySelector(".brightness-input").value,
      pinned: entry.dataset.pinned === "true",
      visible: entry.dataset.visible !== "false",
      type: entry.dataset.coordinateType || "coordinate",
      comparisonId: entry.dataset.comparisonId ?? null,
      opened: !coordinateOverlays[
        [...coordinateControls.querySelectorAll(".coordinate-entry")].indexOf(entry)
      ].openedRing.hidden,
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
  coordinateControls.querySelectorAll(".coordinate-entry").forEach((entry) => entry.remove());
  coordinateOverlays.splice(0).forEach((overlay) => {
    overlay.coordinateCrosshair.remove();
    overlay.nearestCrosshair.remove();
    overlay.connector.remove();
    overlay.openedRing.remove();
  });
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

function restoreState(snapshot) {
  clearCoordinates();
  comparisonColors.splice(0);
  colorList.replaceChildren();
  snapshot.coordinates.forEach((coordinate) => {
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
    entry.querySelector(".pin-coordinate").classList.toggle("is-pinned", coordinate.pinned);
    entry.querySelector(".pin-coordinate").textContent = coordinate.pinned ? "📌" : "○";
    entry.querySelector(".visibility-coordinate").classList.toggle("is-hidden", !coordinate.visible);
    entry.querySelector(".visibility-coordinate").textContent = coordinate.visible ? "👁" : "◌";
  });
  snapshot.comparisons.forEach((comparison, comparisonId) => {
    const restored = { ...comparison, rgb: [...comparison.rgb], openedRing: null };
    comparisonColors.push(restored);
    addComparisonSample(restored, comparisonId, comparison.nearestRgb);
  });
  updateCoordinateCrosshair();
  snapshot.coordinates.forEach((coordinate, index) => {
    if (!coordinate.opened) return;
    const entry = coordinateControls.querySelectorAll(".coordinate-entry")[index];
    if (entry) openCoordinateEntry(entry);
  });
  snapshot.comparisons.forEach((comparison, comparisonId) => {
    const restored = comparisonColors[comparisonId];
    const overlay = coordinateOverlays[comparison.coordinateIndex];
    if (restored && overlay) restored.openedRing = overlay.openedRing;
  });
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
    square.dataset.tooltip = `${toneNames[square.dataset.tone]}\n${toneDescriptions[square.dataset.tone]}\n${colorTooltip(square.dataset.rgb.split(",").map(Number))}`;
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

function updateCoordinateCrosshair() {
  const fieldBounds = field.getBoundingClientRect();
  const mapBounds = field.parentElement.getBoundingClientRect();
  const brightnessAxisBounds = brightnessAxis.getBoundingClientRect();
  const saturationAxisBounds = document.querySelector(".saturation-axis").getBoundingClientRect();
  const axisStart = brightnessAxisBounds.left - fieldBounds.left;
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
  const horizontalLineWidth = mapBounds.right - fieldBounds.left + axisStart;

  coordinateControls.querySelectorAll(".coordinate-entry").forEach((entry, index) => {
    const coordinateCrosshair = coordinateOverlays[index].coordinateCrosshair;
    const nearestCrosshair = coordinateOverlays[index].nearestCrosshair;
    const connector = coordinateOverlays[index].connector;
    const openedRing = coordinateOverlays[index].openedRing;
    const coordinateFormat = entry.querySelector(".coordinate-format");
    const brightnessInput = entry.querySelector(".brightness-input");
    const saturationInput = entry.querySelector(".saturation-input");
    const brightness = Number(brightnessInput.value);
    const saturation = Number(saturationInput.value);
    const maximum = coordinateFormat.value === "255" ? 255 : 100;
    const hasBrightness = brightnessInput.value !== ""
      && Number.isFinite(brightness)
      && brightness >= 0
      && brightness <= maximum;
    const hasSaturation = saturationInput.value !== ""
      && Number.isFinite(saturation)
      && saturation >= 0
      && saturation <= maximum;
    const horizontalLine = coordinateCrosshair.querySelector(".coordinate-line-horizontal");
    const verticalLine = coordinateCrosshair.querySelector(".coordinate-line-vertical");
    const point = coordinateCrosshair.querySelector(".coordinate-point");
    const saturationValueElement = coordinateCrosshair.querySelector(".coordinate-value-saturation");
    const brightnessValueElement = coordinateCrosshair.querySelector(".coordinate-value-brightness");
    const isVisible = entry.dataset.visible !== "false";
    [coordinateCrosshair, nearestCrosshair, connector, openedRing].forEach((overlayElement) => {
      overlayElement.classList.toggle("coordinate-is-hidden", !isVisible);
    });

    if (!hasBrightness && !hasSaturation) {
      coordinateCrosshair.classList.remove("is-visible");
      nearestCrosshair.classList.remove("is-visible");
      connector.classList.remove("is-visible");
      entry.querySelector(".open-coordinate").disabled = true;
      entry.querySelector(".open-coordinate").textContent = "開";
      openedRing.hidden = true;
      point.style.pointerEvents = "none";
      return;
    }

    const x = hasSaturation
      ? squareRight + (saturation / maximum) * axisWidth
      : 0;
    const y = hasBrightness
      ? (1 - brightness / maximum) * fieldBounds.height
      : 0;
    entry.dataset.coordinateX = `${x}`;
    entry.dataset.coordinateY = `${y}`;
    entry.dataset.coordinateSaturation = `${saturation}`;
    entry.dataset.coordinateBrightness = `${brightness}`;
    updateComparisonCoordinateSample(entry);
    if (!openedRing.hidden) updateOpenedRing(entry, openedRing);
    horizontalLine.style.display = hasBrightness ? "block" : "none";
    verticalLine.style.display = hasSaturation ? "block" : "none";
    point.style.display = hasBrightness && hasSaturation ? "block" : "none";
    point.style.pointerEvents = hasBrightness
      && hasSaturation
      && entry.dataset.pinned !== "true"
      ? "auto"
      : "none";
    point.style.cursor = point.style.pointerEvents === "auto" ? "grab" : "default";
    saturationValueElement.style.display = hasSaturation ? "block" : "none";
    brightnessValueElement.style.display = hasBrightness ? "block" : "none";
    const nearest = circleCenters.reduce((closest, current) => {
      const distance = Math.hypot(current.x - x, current.y - y);
      return distance < closest.distance ? { ...current, distance } : closest;
    }, { ...circleCenters[0], distance: Infinity });

    coordinateCrosshair.style.setProperty("--coordinate-axis-width", `${horizontalLineWidth}px`);
    coordinateCrosshair.style.setProperty("--coordinate-axis-height", `${fieldBounds.height}px`);
    coordinateCrosshair.style.left = `${x}px`;
    coordinateCrosshair.style.top = `${y}px`;
    saturationValueElement.style.left = `${fieldBounds.left + x}px`;
    saturationValueElement.style.top = `${saturationAxisBounds.top + 8}px`;
    brightnessValueElement.style.left = `${brightnessAxisBounds.left - 8}px`;
    brightnessValueElement.style.top = `${fieldBounds.top + y}px`;
    if (hasSaturation) {
      const saturationPercent = (saturation / maximum) * 100;
      const saturation255 = (saturation / maximum) * 255;
      saturationValueElement.textContent =
        `${Number(saturationPercent.toFixed(2))}% / ${Number(saturation255.toFixed(2))}`;
    }
    if (hasBrightness) {
      const brightnessPercent = (brightness / maximum) * 100;
      const brightness255 = (brightness / maximum) * 255;
      brightnessValueElement.textContent =
        `${Number(brightnessPercent.toFixed(2))}%\n${Number(brightness255.toFixed(2))}`;
    }
    nearestCrosshair.style.setProperty("--coordinate-axis-width", `${horizontalLineWidth}px`);
    nearestCrosshair.style.setProperty("--coordinate-axis-height", `${fieldBounds.height}px`);
    const isColorCoordinate = entry.dataset.coordinateType === "color";
    nearestCrosshair.style.left = `${hasBrightness && hasSaturation && !isColorCoordinate ? nearest.x : 0}px`;
    nearestCrosshair.style.top = `${hasBrightness && hasSaturation && !isColorCoordinate ? nearest.y : 0}px`;
    coordinateCrosshair.classList.add("is-visible");
    nearestCrosshair.classList.toggle("is-visible", hasBrightness && hasSaturation && !isColorCoordinate);
    entry.querySelector(".open-coordinate").disabled = !(hasBrightness && hasSaturation);
    if (hasBrightness && hasSaturation && !isColorCoordinate) {
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
  ring.dataset.tooltip = `${toneNames[tone]}\n${toneDescriptions[tone]}`;

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

  ring.dataset.saturation = saturation;
  field.append(ring);
  return ring;
}

const rings = columns.flatMap(({ saturation, tones, shape }) =>
  tones.map((tone) => createRing(saturation, tone, shape)),
);

function layoutRings() {
  const { width, height } = field.getBoundingClientRect();
  const maxRows = Math.max(
    ...columns
      .filter(({ shape }) => shape !== "square")
      .map(({ tones }) => tones.length),
  );
  const colorColumns = columns.filter(({ shape }) => shape !== "square");
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
  const fieldBounds = field.getBoundingClientRect();
  const mapBounds = field.parentElement.getBoundingClientRect();
  const groupStart = Math.max(
    visualRadius,
    (width - groupWidth) / 2 + visualRadius + visualDiameter,
  );
  const brightnessAxisLeft = fieldBounds.left - mapBounds.left
    + groupStart - visualRadius - ringSize * 0.68 - 42;

  field.style.setProperty("--ring-size", `${ringSize}px`);
  field.style.setProperty("--ring-radius", `${ringSize * 0.43}px`);
  brightnessAxis.style.left = `${brightnessAxisLeft}px`;
  brightnessAxisLabel.style.left = `${brightnessAxisLeft - 20}px`;
  brightnessArrow.style.left = `${brightnessAxisLeft + 7}px`;

  let ringIndex = 0;
  const rowGap = visualDiameter * gapRatio;
  const colorGroupHeight = visualDiameter + rowGap * (maxRows - 1);
  const groupStartY = (height - colorGroupHeight) / 2 + visualRadius;

  columns.forEach(({ saturation, tones, shape, lightness: toneLightness }, columnIndex) => {
    const count = tones.length;
    const colorColumnIndex = shape === "square"
      ? -1
      : colorColumns.findIndex(({ tones: colorTones }) => colorTones === tones);
    const columnX = shape === "square"
      ? groupStart - visualRadius - ringSize * 0.34 - 28
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
      const ring = rings[ringIndex];
      const centerY = count === 1
        ? columnStartY + (columnGroupHeight - visualDiameter) / 2
        : columnStartY + columnRowGap * rowIndex;
      const lightness = toneLightness
        ? toneLightness[rowIndex]
        : Math.round(92 - (centerY / height) * 78);

      ring.style.left = `${columnX}px`;
      ring.style.top = `${centerY}px`;
      ring.dataset.x = columnX;
      ring.dataset.y = centerY;
      ring.dataset.lightness = lightness;
      if (shape === "square") {
        const squareRgb = [lightness * 2.55, lightness * 2.55, lightness * 2.55].map(Math.round);
        ring.dataset.rgb = squareRgb.join(",");
        ring.dataset.tooltip = `${toneNames[ring.dataset.tone]}\n${toneDescriptions[ring.dataset.tone]}\n${colorTooltip(squareRgb)}`;
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

      ringIndex += 1;
    }
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
    const coordinateIndex = comparison.coordinateIndex;
    const coordinateEntry = coordinateControls.querySelector(
      `.coordinate-entry[data-comparison-id="${comparisonIndex}"]`,
    ) || coordinateControls.querySelectorAll(".coordinate-entry")[coordinateIndex];
    if (coordinateEntry?.dataset.visible === "false") return;
    const [inputHue] = rgbToHsl(comparison.rgb);
    const standardRing = comparison.nearestRing;
    const standardSwatch = comparison.nearestSwatch;
    const standardHand = document.createElement("div");
    standardHand.className = "color-hand color-hand-standard";
    standardHand.dataset.comparisonId = String(comparisonIndex);
    standardHand.dataset.tooltip = `最寄り標準色\n${colorTooltip(standardSwatch.dataset.rgb.split(",").map(Number))}`;
    standardHand.style.left = `${standardRing.dataset.x}px`;
    standardHand.style.top = `${standardRing.dataset.y}px`;
    standardHand.style.setProperty("--hand-angle", `${Number(standardSwatch.dataset.hue) - 90}deg`);
    field.append(standardHand);

    const actualHand = document.createElement("div");
    actualHand.className = "color-hand color-hand-actual";
    actualHand.dataset.comparisonId = String(comparisonIndex);
    actualHand.dataset.tooltip = `入力色の色相\n${inputHue}°`;
    actualHand.style.left = openedRing.style.left;
    actualHand.style.top = openedRing.style.top;
    actualHand.style.setProperty("--hand-angle", `${inputHue - 90}deg`);
    field.append(actualHand);

    if (comparison.originalX !== null && comparison.originalY !== null) {
      const originalHand = document.createElement("div");
      originalHand.className = "color-hand color-hand-original";
      originalHand.dataset.comparisonId = String(comparisonIndex);
      originalHand.style.left = `${comparison.originalX}px`;
      originalHand.style.top = `${comparison.originalY}px`;
      originalHand.style.setProperty("--hand-angle", `${inputHue - 90}deg`);
      field.append(originalHand);
    }

    const connector = document.createElement("span");
    connector.className = "comparison-ring-connector";
    const openedX = Number(openedRing.dataset.x);
    const openedY = Number(openedRing.dataset.y);
    const standardX = Number(standardRing.dataset.x);
    const standardY = Number(standardRing.dataset.y);
    const connectorLength = Math.hypot(standardX - openedX, standardY - openedY);
    const connectorAngle = Math.atan2(standardY - openedY, standardX - openedX)
      * 180 / Math.PI;
    connector.style.left = `${openedX}px`;
    connector.style.top = `${openedY}px`;
    connector.style.width = `${connectorLength}px`;
    connector.style.transform = `rotate(${connectorAngle}deg)`;
    connector.dataset.comparisonId = String(comparisonIndex);
    field.append(connector);
  });
}

colorForms.forEach((colorForm) => colorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const colorInput = colorForm.querySelector("input");
  const rgb = parseColor(colorInput.value, colorForm.dataset.format);
  if (!rgb) {
    colorInput.setCustomValidity("正しい形式で入力してください");
    colorInput.reportValidity();
    return;
  }
  colorInput.setCustomValidity("");
  const value = `rgb(${rgb.join(", ")})`;
  const comparisonId = comparisonColors.length;
  const comparison = {
    value,
    rgb,
    coordinateIndex: null,
    openedRing: null,
    nearestRing: null,
    nearestSwatch: null,
  };
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
    comparison.coordinateIndex = [...coordinateControls.querySelectorAll(".coordinate-entry")].indexOf(entry);
    entry.dataset.comparisonId = String(comparisonId);
    updateComparisonCoordinateSample(entry);
    openCoordinateEntry(entry);
    const index = [...coordinateControls.querySelectorAll(".coordinate-entry")].indexOf(entry);
    comparison.openedRing = coordinateOverlays[index].openedRing;
    comparison.originalX = Number(comparison.openedRing.dataset.x);
    comparison.originalY = Number(comparison.openedRing.dataset.y);
  }
  updateHands();
  logAction(`色 ${rgbToHex(rgb)} を追加しました`);
  recordHistory();
}));

hslDisplayFormat.addEventListener("change", refreshTooltips);
coordinateControls.addEventListener("input", updateCoordinateCrosshair);
coordinateControls.addEventListener("change", () => {
  updateCoordinateCrosshair();
  scheduleHistory();
});
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
  entry.querySelector(".pin-coordinate").textContent = "○";
  entry.querySelector(".pin-coordinate").classList.remove("is-pinned");
  entry.querySelector(".visibility-coordinate").textContent = "👁";
  entry.querySelector(".visibility-coordinate").classList.remove("is-hidden");
  entry.querySelector(".visibility-coordinate").setAttribute("aria-label", "座標を非表示");
  entry.querySelector(".visibility-coordinate").setAttribute("title", "座標を非表示");
  entry.dataset.pinned = "false";
  entry.dataset.visible = "true";
  entry.dataset.coordinateType = "coordinate";
  coordinateControls.insertBefore(entry, addCoordinateButton);
  coordinateOverlays.push(createCoordinateOverlay());
  updateCoordinateCrosshair();
  entry.querySelector(".saturation-input").focus();
  return entry;
}

function addCoordinateAtValues(saturation, brightness) {
  const emptyEntry = [...coordinateControls.querySelectorAll(".coordinate-entry")]
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
  const index = [...coordinateControls.querySelectorAll(".coordinate-entry")].indexOf(entry);
  const overlay = coordinateOverlays[index];
  if (!overlay || overlay.openedRing.hidden === false) return;
  updateOpenedRing(entry, overlay.openedRing);
  overlay.openedRing.hidden = false;
  entry.querySelector(".open-coordinate").textContent = "閉";
}

coordinateControls.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-coordinate");
  if (removeButton) {
    const entry = removeButton.closest(".coordinate-entry");
    const entries = [...coordinateControls.querySelectorAll(".coordinate-entry")];
    const index = entries.indexOf(entry);
    entry.remove();
    const overlay = coordinateOverlays.splice(index, 1)[0];
    overlay.coordinateCrosshair.remove();
    overlay.nearestCrosshair.remove();
    overlay.connector.remove();
    overlay.openedRing.remove();
    updateCoordinateCrosshair();
    updateHands();
    logAction("座標を削除しました");
    recordHistory();
  }
});
addCoordinateButton.addEventListener("click", () => {
  addCoordinateEntry();
  logAction("座標入力欄を追加しました");
  recordHistory();
});
coordinateControls.addEventListener("click", (event) => {
  const openButton = event.target.closest(".open-coordinate");
  if (!openButton || openButton.disabled) return;
  const entry = openButton.closest(".coordinate-entry");
  const index = [...coordinateControls.querySelectorAll(".coordinate-entry")].indexOf(entry);
  const overlay = coordinateOverlays[index];
  const openedRing = overlay.openedRing;
  if (!openedRing.hidden) {
    openedRing.hidden = true;
    openButton.textContent = "開く";
    updateCoordinateCrosshair();
    updateHands();
    recordHistory();
    return;
  }
  openCoordinateEntry(entry);
  updateCoordinateCrosshair();
  updateHands();
  recordHistory();
});
coordinateControls.addEventListener("click", (event) => {
  const visibilityButton = event.target.closest(".visibility-coordinate");
  if (visibilityButton) {
    const entry = visibilityButton.closest(".coordinate-entry");
    const isVisible = entry.dataset.visible !== "false";
    entry.dataset.visible = String(!isVisible);
    visibilityButton.classList.toggle("is-hidden", isVisible);
    visibilityButton.textContent = isVisible ? "◌" : "👁";
    visibilityButton.setAttribute("aria-label", isVisible ? "座標を表示" : "座標を非表示");
    visibilityButton.setAttribute("title", isVisible ? "座標を表示" : "座標を非表示");
    updateCoordinateCrosshair();
    updateHands();
    recordHistory();
    return;
  }
  const pinButton = event.target.closest(".pin-coordinate");
  if (!pinButton) return;
  const entry = pinButton.closest(".coordinate-entry");
  const isPinned = entry.dataset.pinned === "true";
  entry.dataset.pinned = String(!isPinned);
  pinButton.classList.toggle("is-pinned", !isPinned);
  pinButton.textContent = isPinned ? "○" : "📌";
  pinButton.setAttribute("aria-label", isPinned ? "座標をピン留め" : "ピン留めを解除");
  pinButton.setAttribute("title", isPinned ? "座標をピン留め" : "ピン留めを解除");
  updateCoordinateCrosshair();
  recordHistory();
});
coordinateControls.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("input")) {
    event.preventDefault();
    addCoordinateEntry();
  }
});

let coordinateDrag = null;
field.addEventListener("pointerdown", (event) => {
  const point = event.target.closest(".coordinate-point");
  if (!point) return;
  const index = coordinateOverlays.findIndex((overlay) =>
    overlay.coordinateCrosshair.contains(point));
  const entry = coordinateControls.querySelectorAll(".coordinate-entry")[index];
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
});

field.addEventListener("pointermove", (event) => {
  if (!coordinateDrag || coordinateDrag.pointerId !== event.pointerId) return;
  const entry = coordinateControls.querySelectorAll(".coordinate-entry")[coordinateDrag.index];
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
});

function stopCoordinateDrag(event) {
  if (coordinateDrag && coordinateDrag.pointerId === event.pointerId) {
    const entry = coordinateControls.querySelectorAll(".coordinate-entry")[coordinateDrag.index];
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

field.addEventListener("pointerup", stopCoordinateDrag);
field.addEventListener("pointercancel", stopCoordinateDrag);

new ResizeObserver(layoutRings).observe(field);
layoutRings();
recordHistory();

for (const container of [field, colorList]) {
  container.addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-tooltip]");
    if (target && container.contains(target)) showTooltip(target);
  });
  container.addEventListener("pointerout", (event) => {
    const target = event.target.closest("[data-tooltip]");
    if (!target || target.contains(event.relatedTarget)) return;
    hideTooltip();
  });
}

field.addEventListener("click", (event) => {
  const swatch = event.target.closest(".tone-ring i");
  if (swatch) copySwatchHex(swatch);
});

colorList.addEventListener("pointerover", (event) => {
  const sample = event.target.closest(".color-sample");
  if (!sample) return;
  const handType = sample.dataset.sampleType === "standard" ? "standard" : "actual";
  field.querySelector(`.color-hand-${handType}[data-comparison-id="${sample.dataset.comparisonId}"]`)
    ?.classList.add("is-hovered");
  if (sample.dataset.sampleType === "actual") {
    field.querySelector(`.color-hand-original[data-comparison-id="${sample.dataset.comparisonId}"]`)
      ?.classList.add("is-original-visible");
  }
});

colorList.addEventListener("pointerout", (event) => {
  const sample = event.target.closest(".color-sample");
  if (!sample || sample.contains(event.relatedTarget)) return;
  const handType = sample.dataset.sampleType === "standard" ? "standard" : "actual";
  field.querySelector(`.color-hand-${handType}[data-comparison-id="${sample.dataset.comparisonId}"]`)
    ?.classList.remove("is-hovered");
  if (sample.dataset.sampleType === "actual") {
    field.querySelector(`.color-hand-original[data-comparison-id="${sample.dataset.comparisonId}"]`)
      ?.classList.remove("is-original-visible");
  }
});
