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
  const axisStart = brightnessAxisBounds.left - fieldBounds.left;
  const square = rings.find((ring) => ring.classList.contains("tone-square"));
  const circleCenters = rings
    .filter((ring) => !ring.classList.contains("tone-square"))
    .map((ring) => ({
      ring,
      x: Number(ring.dataset.x),
      y: Number(ring.dataset.y),
    }));
  const squareLeft = Number(square.dataset.x) - Number.parseFloat(getComputedStyle(field).getPropertyValue("--ring-size")) * 0.34;
  const rightmostCircle = circleCenters.reduce((rightmost, current) =>
    current.x > rightmost.x ? current : rightmost,
  );
  const axisWidth = rightmostCircle.x - squareLeft;
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

    if (!hasBrightness && !hasSaturation) {
      coordinateCrosshair.classList.remove("is-visible");
      nearestCrosshair.classList.remove("is-visible");
      connector.classList.remove("is-visible");
      entry.querySelector(".open-coordinate").disabled = true;
      entry.querySelector(".open-coordinate").textContent = "開く";
      openedRing.hidden = true;
      point.style.pointerEvents = "none";
      return;
    }

    const x = hasSaturation
      ? squareLeft + (saturation / maximum) * axisWidth
      : 0;
    const y = hasBrightness
      ? (1 - brightness / maximum) * fieldBounds.height
      : 0;
    entry.dataset.coordinateX = `${x}`;
    entry.dataset.coordinateY = `${y}`;
    entry.dataset.coordinateSaturation = `${saturation}`;
    entry.dataset.coordinateBrightness = `${brightness}`;
    horizontalLine.style.display = hasBrightness ? "block" : "none";
    verticalLine.style.display = hasSaturation ? "block" : "none";
    point.style.display = hasBrightness && hasSaturation ? "block" : "none";
    point.style.pointerEvents = hasBrightness
      && hasSaturation
      && openedRing.hidden
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

    coordinateCrosshair.style.setProperty("--coordinate-axis-start", `${axisStart}px`);
    coordinateCrosshair.style.setProperty("--coordinate-axis-width", `${horizontalLineWidth}px`);
    coordinateCrosshair.style.setProperty("--coordinate-axis-height", `${fieldBounds.height}px`);
    coordinateCrosshair.style.left = `${x}px`;
    coordinateCrosshair.style.top = `${y}px`;
    if (hasSaturation) {
      saturationValueElement.textContent = coordinateFormat.value === "255"
        ? `${saturation}`
        : `${saturation}%`;
    }
    if (hasBrightness) {
      brightnessValueElement.textContent = coordinateFormat.value === "255"
        ? `${brightness}`
        : `${brightness}%`;
    }
    nearestCrosshair.style.setProperty("--coordinate-axis-start", `${axisStart}px`);
    nearestCrosshair.style.setProperty("--coordinate-axis-width", `${horizontalLineWidth}px`);
    nearestCrosshair.style.setProperty("--coordinate-axis-height", `${fieldBounds.height}px`);
    nearestCrosshair.style.left = `${hasBrightness && hasSaturation ? nearest.x : 0}px`;
    nearestCrosshair.style.top = `${hasBrightness && hasSaturation ? nearest.y : 0}px`;
    coordinateCrosshair.classList.add("is-visible");
    nearestCrosshair.classList.toggle("is-visible", hasBrightness && hasSaturation);
    entry.querySelector(".open-coordinate").disabled = !(hasBrightness && hasSaturation);
    if (hasBrightness && hasSaturation) {
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
}

function parseColor(value, format) {
  const normalized = value.trim().toLowerCase();
  const normalizeRgb = (channels) =>
    channels.every((channel) => channel >= 0 && channel <= 255)
      ? channels
      : null;
  const hex = normalized.replace("#", "");
  if (format === "hex" && /^[\da-f]{3,8}$/.test(hex)) {
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
    const rgbMatch = normalized.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/);
    if (rgbMatch) return normalizeRgb(rgbMatch.slice(1).map(Number));
  }

  const hslMatch = normalized.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)/);
  if (hslMatch) {
    const rawHue = Number(hslMatch[1]);
    const saturation = Number(hslMatch[2]);
    const lightness = Number(hslMatch[4]);
    const isPercent = format === "hslPercent";
    if ((isPercent && (!hslMatch[3] || !hslMatch[5])) || (!isPercent && (hslMatch[3] || hslMatch[5]))) {
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
  const openedRings = [...field.querySelectorAll(".opened-tone-ring:not([hidden])")];
  const candidateRings = openedRings.length > 0 ? openedRings : rings;
  comparisonColors.forEach((comparison, comparisonIndex) => {
    let nearest = null;
    let nearestDistance = Infinity;
    candidateRings.forEach((ring) => {
      ring.querySelectorAll("i").forEach((swatch) => {
        const distance = colorDistance(comparison.rgb, swatch.dataset.rgb.split(",").map(Number));
        if (distance < nearestDistance) {
          nearest = { ring, swatch };
          nearestDistance = distance;
        }
      });
    });
    if (!nearest) return;

    const hand = document.createElement("div");
    hand.className = "color-hand";
    hand.dataset.comparisonId = String(comparisonIndex);
    hand.style.left = `${nearest.ring.dataset.x}px`;
    hand.style.top = `${nearest.ring.dataset.y}px`;
    const ringBounds = nearest.ring.getBoundingClientRect();
    const swatchBounds = nearest.swatch.getBoundingClientRect();
    const ringCenterX = ringBounds.left + ringBounds.width / 2;
    const ringCenterY = ringBounds.top + ringBounds.height / 2;
    const swatchCenterX = swatchBounds.left + swatchBounds.width / 2;
    const swatchCenterY = swatchBounds.top + swatchBounds.height / 2;
    const handAngle = Math.atan2(
      swatchCenterX - ringCenterX,
      ringCenterY - swatchCenterY,
    ) * (180 / Math.PI);
    hand.style.setProperty("--hand-angle", `${handAngle}deg`);
    field.append(hand);
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
  comparisonColors.push({ value, rgb });
  const sample = document.createElement("span");
  sample.className = "color-sample";
  sample.dataset.comparisonId = String(comparisonId);
  sample.dataset.rgb = rgb.join(",");
  sample.dataset.tooltip = colorTooltip(rgb);
  sample.style.backgroundColor = value;
  colorList.append(sample);
  colorInput.value = "";
  const nearestRing = rings.reduce((closest, ring) => {
    const swatches = [...ring.querySelectorAll("i")];
    if (swatches.length === 0) return closest;
    const nearestSwatch = swatches.reduce((nearest, swatch) => {
      const distance = colorDistance(rgb, swatch.dataset.rgb.split(",").map(Number));
      return distance < nearest.distance ? { swatch, distance } : nearest;
    }, { swatch: null, distance: Infinity });
    return nearestSwatch.distance < closest.distance
      ? { ring, distance: nearestSwatch.distance }
      : closest;
  }, { ring: null, distance: Infinity }).ring;
  if (nearestRing) addCoordinateAtRing(nearestRing);
  updateHands();
}));

hslDisplayFormat.addEventListener("change", refreshTooltips);
coordinateControls.addEventListener("input", updateCoordinateCrosshair);
coordinateControls.addEventListener("change", updateCoordinateCrosshair);
function addCoordinateEntry(saturationValue = "", brightnessValue = "", format = "percent") {
  const entry = coordinateControls.querySelector(".coordinate-entry").cloneNode(true);
  entry.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });
  entry.querySelector(".coordinate-format").value = format;
  entry.querySelector(".saturation-input").value = saturationValue;
  entry.querySelector(".brightness-input").value = brightnessValue;
  entry.querySelector(".open-coordinate").textContent = "開く";
  entry.querySelector(".open-coordinate").disabled = true;
  entry.querySelector(".pin-coordinate").textContent = "固定";
  entry.querySelector(".pin-coordinate").classList.remove("is-pinned");
  entry.dataset.pinned = "false";
  coordinateControls.insertBefore(entry, addCoordinateButton);
  coordinateOverlays.push(createCoordinateOverlay());
  updateCoordinateCrosshair();
  entry.querySelector(".saturation-input").focus();
  return entry;
}

function addCoordinateAtRing(ring) {
  const fieldBounds = field.getBoundingClientRect();
  const square = rings.find((currentRing) => currentRing.classList.contains("tone-square"));
  const squareLeft = Number(square.dataset.x)
    - Number.parseFloat(getComputedStyle(field).getPropertyValue("--ring-size")) * 0.34;
  const rightmostCircle = rings
    .filter((currentRing) => !currentRing.classList.contains("tone-square"))
    .reduce((rightmost, currentRing) =>
      Number(currentRing.dataset.x) > Number(rightmost.dataset.x) ? currentRing : rightmost,
    );
  const axisWidth = Number(rightmostCircle.dataset.x) - squareLeft;
  const saturation = Math.max(0, Math.min(100,
    ((Number(ring.dataset.x) - squareLeft) / axisWidth) * 100));
  const brightness = Math.max(0, Math.min(100,
    (1 - Number(ring.dataset.y) / fieldBounds.height) * 100));
  const emptyEntry = [...coordinateControls.querySelectorAll(".coordinate-entry")]
    .find((entry) =>
      entry.querySelector(".saturation-input").value === ""
      && entry.querySelector(".brightness-input").value === "");
  if (emptyEntry) {
    emptyEntry.querySelector(".coordinate-format").value = "percent";
    emptyEntry.querySelector(".saturation-input").value = Number(saturation.toFixed(2));
    emptyEntry.querySelector(".brightness-input").value = Number(brightness.toFixed(2));
    updateCoordinateCrosshair();
    return emptyEntry;
  }
  return addCoordinateEntry(Number(saturation.toFixed(2)), Number(brightness.toFixed(2)));
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
  }
});
addCoordinateButton.addEventListener("click", () => {
  addCoordinateEntry();
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
    return;
  }
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
    swatch.style.backgroundColor = `rgb(${rgb.join(" ")})`;
  });
  openedRing.hidden = false;
  openButton.textContent = "閉じる";
  updateCoordinateCrosshair();
  updateHands();
});
coordinateControls.addEventListener("click", (event) => {
  const pinButton = event.target.closest(".pin-coordinate");
  if (!pinButton) return;
  const entry = pinButton.closest(".coordinate-entry");
  const isPinned = entry.dataset.pinned === "true";
  entry.dataset.pinned = String(!isPinned);
  pinButton.classList.toggle("is-pinned", !isPinned);
  pinButton.textContent = isPinned ? "固定" : "解除";
  updateCoordinateCrosshair();
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
    || !coordinateOverlays[index].openedRing.hidden) return;
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
  const squareLeft = Number(square.dataset.x)
    - Number.parseFloat(getComputedStyle(field).getPropertyValue("--ring-size")) * 0.34;
  const rightmostCircle = rings
    .filter((ring) => !ring.classList.contains("tone-square"))
    .reduce((rightmost, ring) =>
      Number(ring.dataset.x) > Number(rightmost.dataset.x) ? ring : rightmost);
  const axisWidth = Number(rightmostCircle.dataset.x) - squareLeft;
  const maximum = entry.querySelector(".coordinate-format").value === "255" ? 255 : 100;
  const x = Math.max(squareLeft, Math.min(Number(rightmostCircle.dataset.x),
    event.clientX - fieldBounds.left));
  const y = Math.max(0, Math.min(fieldBounds.height, event.clientY - fieldBounds.top));
  entry.querySelector(".saturation-input").value =
    (((x - squareLeft) / axisWidth) * maximum).toFixed(2);
  entry.querySelector(".brightness-input").value =
    ((1 - y / fieldBounds.height) * maximum).toFixed(2);
  updateCoordinateCrosshair();
  event.preventDefault();
});

function stopCoordinateDrag(event) {
  if (coordinateDrag && coordinateDrag.pointerId === event.pointerId) {
    coordinateDrag = null;
  }
}

field.addEventListener("pointerup", stopCoordinateDrag);
field.addEventListener("pointercancel", stopCoordinateDrag);

new ResizeObserver(layoutRings).observe(field);
layoutRings();

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
  field.querySelector(`.color-hand[data-comparison-id="${sample.dataset.comparisonId}"]`)
    ?.classList.add("is-hovered");
});

colorList.addEventListener("pointerout", (event) => {
  const sample = event.target.closest(".color-sample");
  if (!sample || sample.contains(event.relatedTarget)) return;
  field.querySelector(`.color-hand[data-comparison-id="${sample.dataset.comparisonId}"]`)
    ?.classList.remove("is-hovered");
});
