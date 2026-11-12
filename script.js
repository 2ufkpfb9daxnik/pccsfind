const field = document.querySelector("#map-field");
const brightnessAxis = document.querySelector(".brightness-axis");
const brightnessAxisLabel = document.querySelector(".axis-label-brightness");
const brightnessArrow = document.querySelector(".axis-arrow-brightness");
const colorForms = document.querySelectorAll(".color-form");
const colorList = document.querySelector("#color-list");
const hslDisplayFormat = document.querySelector("#hsl-display-format");
const comparisonColors = [];
const tooltip = document.createElement("div");
tooltip.className = "color-tooltip";
document.body.append(tooltip);
const copyNotice = document.createElement("div");
copyNotice.className = "copy-notice";
document.body.append(copyNotice);
let copyNoticeTimer;

const columns = [
  { saturation: 3, tones: ["p", "ltg", "g", "dkg"] },
  { saturation: 5, tones: ["lt", "sf", "d", "dk"] },
  { saturation: 7, tones: ["b", "s", "dp"] },
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

function createRing(saturation, tone) {
  const ring = document.createElement("div");
  ring.className = "tone-ring";
  ring.dataset.tone = tone;
  ring.dataset.tooltip = `${toneNames[tone]}\n${toneDescriptions[tone]}`;

  for (let index = 0; index < 12; index += 1) {
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

const rings = columns.flatMap(({ saturation, tones }) =>
  tones.map((tone) => createRing(saturation, tone)),
);

function layoutRings() {
  const { width, height } = field.getBoundingClientRect();
  const maxRows = Math.max(...columns.map(({ tones }) => tones.length));
  const visualDiameterRatio = 1.26;
  const gapRatio = 1.04;
  const ringSize = Math.min(
    width / (visualDiameterRatio * (1 + (columns.length - 1) * gapRatio)),
    height / (visualDiameterRatio * (1 + (maxRows - 1) * gapRatio)),
  );
  const visualRadius = ringSize * visualDiameterRatio / 2;
  const visualDiameter = visualRadius * 2;
  const columnGap = visualDiameter * gapRatio;
  const groupWidth = visualDiameter + columnGap * (columns.length - 1);
  const groupStart = (width - groupWidth) / 2 + visualRadius;
  const fieldBounds = field.getBoundingClientRect();
  const mapBounds = field.parentElement.getBoundingClientRect();
  const brightnessAxisLeft = fieldBounds.left - mapBounds.left + groupStart - visualRadius - 14;

  field.style.setProperty("--ring-size", `${ringSize}px`);
  field.style.setProperty("--ring-radius", `${ringSize * 0.43}px`);
  brightnessAxis.style.left = `${brightnessAxisLeft}px`;
  brightnessAxisLabel.style.left = `${brightnessAxisLeft - 20}px`;
  brightnessArrow.style.left = `${brightnessAxisLeft + 7}px`;

  let ringIndex = 0;
  columns.forEach(({ saturation, tones }, columnIndex) => {
    const count = tones.length;
    const columnX = groupStart + columnGap * columnIndex;
    const rowGap = visualDiameter * gapRatio;
    const groupHeight = visualDiameter + rowGap * (count - 1);
    const groupStartY = (height - groupHeight) / 2 + visualRadius;

    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      const ring = rings[ringIndex];
      const centerY = groupStartY + rowGap * rowIndex;
      const lightness = Math.round(92 - (centerY / height) * 78);

      ring.style.left = `${columnX}px`;
      ring.style.top = `${centerY}px`;
      ring.dataset.x = columnX;
      ring.dataset.y = centerY;
      ring.dataset.lightness = lightness;

      ring.querySelectorAll("i").forEach((swatch, index) => {
        const rgb = hslToRgb(
          index * 30,
          (saturation / 9) * 100,
          lightness,
        );
        swatch.dataset.rgb = rgb.join(",");
        swatch.dataset.hex = rgbToHex(rgb);
        swatch.dataset.tooltip = colorTooltip(rgb);
        swatch.style.backgroundColor = `rgb(${rgb.join(" ")})`;
      });

      ringIndex += 1;
    }
  });

  updateHands();
}

function updateHands() {
  field.querySelectorAll(".color-hand").forEach((hand) => hand.remove());
  comparisonColors.forEach((comparison, comparisonIndex) => {
    let nearest = null;
    let nearestDistance = Infinity;
    rings.forEach((ring) => {
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
  updateHands();
}));

hslDisplayFormat.addEventListener("change", refreshTooltips);

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
