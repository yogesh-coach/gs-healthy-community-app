const STORAGE_KEY = "gs-healthy-community-record";
const PROGRAM_RATE = 300;
const HEALTH_CONDITIONS = [
  "Headache / Dizziness",
  "Gas / Acidity",
  "Constipation / Motion Issues",
  "Tiredness",
  "Weakness",
  "Low Energy",
  "Breathing Issues",
  "Hungry Frequently",
  "Period Problem",
  "PCOS / PCOD",
  "Diabetes",
  "Thyroid",
  "Sleep Issues",
  "High BP",
  "Low BP",
  "Joint Pain",
  "Knee Pain",
  "Back Pain",
];

const form = document.getElementById("healthForm");
const stepButtons = Array.from(document.querySelectorAll(".step-tab"));
const steps = Array.from(document.querySelectorAll(".step-panel"));
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const saveButton = document.getElementById("saveButton");
const resetButton = document.getElementById("resetButton");
const pdfButton = document.getElementById("pdfButton");
const numberOfCupsRow = document.getElementById("numberOfCupsRow");
const snacksWhatRow = document.getElementById("snacksWhatRow");
const currentStepLabel = document.getElementById("currentStepLabel");
const reportSheet = document.getElementById("reportSheet");

let currentStep = 0;

init();

function init() {
  seedToday();
  buildHealthChecklist();
  restoreData();
  updateUi();

  form.addEventListener("input", handleFormChange);
  form.addEventListener("change", handleFormChange);

  stepButtons.forEach((button) => {
    button.addEventListener("click", () => setStep(Number(button.dataset.step)));
  });

  prevButton.addEventListener("click", () => setStep(currentStep - 1));
  nextButton.addEventListener("click", () => setStep(currentStep + 1));

  saveButton.addEventListener("click", () => {
    persistData();
    window.alert("Data saved successfully on this device.");
  });

  resetButton.addEventListener("click", resetForm);
  pdfButton.addEventListener("click", downloadPdf);
}

function seedToday() {
  const dateField = document.getElementById("date");
  if (!dateField.value) {
    dateField.value = new Date().toLocaleDateString("en-CA");
  }
}

function buildHealthChecklist() {
  const grid = document.getElementById("healthChecklistGrid");
  grid.innerHTML = HEALTH_CONDITIONS.map((label) => {
    const safeId = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `
      <label class="check-card" for="condition-${safeId}">
        <input id="condition-${safeId}" name="healthConditions" type="checkbox" value="${escapeHtml(label)}" />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }).join("");
}

function handleFormChange(event) {
  const target = event.target;

  if (target.name === "gender" && !target.checked) {
    return;
  }

  updateUi();
  persistData();
}

function updateUi() {
  syncConditionalRows();
  updateAutoMetrics();
  renderReport();
  syncStepUi();
}

function syncConditionalRows() {
  const teaCoffee = getRadioValue("teaCoffee");
  const snacks = getRadioValue("snacks");

  toggleConditionalRow(numberOfCupsRow, "numberOfCups", teaCoffee === "Yes");
  toggleConditionalRow(snacksWhatRow, "snacksWhat", snacks === "Yes");
}

function toggleConditionalRow(row, inputId, show) {
  row.classList.toggle("hidden", !show);

  if (!show) {
    document.getElementById(inputId).value = "";
  }
}

function updateAutoMetrics() {
  const height = getNumber("height");
  const weight = getNumber("weight");
  const autoBmi = calculateBmi(height, weight);
  const idealWeight = calculateIdealWeight(height);
  const bmiCategory = getBmiCategory(autoBmi);
  const bmiCategoryBadge = document.getElementById("bmiCategoryAuto");

  document.getElementById("idealWeightValue").textContent = idealWeight === null ? "--" : `${formatNumber(idealWeight)} kg`;
  document.getElementById("bmiAutoValue").textContent = autoBmi === null ? "--" : formatNumber(autoBmi);
  document.getElementById("bmiAutoCaption").textContent = autoBmi === null ? "Enter height and weight" : "Auto BMI based on height and weight";
  document.getElementById("bmiCategoryAuto").textContent = bmiCategory;

  bmiCategoryBadge.dataset.state =
    bmiCategory === "Normal" ? "good" : bmiCategory === "Underweight" ? "warn" : bmiCategory === "Overweight" ? "warn" : bmiCategory === "Obese" ? "high" : "neutral";

  const bodyFatNormal = getBodyFatNormalRange();
  document.getElementById("bodyFatNormalRange").textContent = bodyFatNormal;

  const duration = getNumber("programDuration");
  const totalAmount = duration === null ? 0 : duration * PROGRAM_RATE;
  document.getElementById("programTotalValue").textContent = `Total Amount = Rs. ${totalAmount ? formatNumber(totalAmount) : "0"}`;
}

function renderReport() {
  const data = collectData();

  document.getElementById("reportClientInfo").innerHTML = `
    ${renderReportRow("Name", data.name)}
    ${renderReportRow("Mobile Number", data.mobile)}
    ${renderReportRow("Date", formatDisplayDate(data.date))}
    ${renderReportRow("Invite By", data.inviteBy)}
    ${renderReportRow("Coach Name", data.coachName)}
    ${renderReportRow("Coach Number", data.coachNumber)}
  `;

  document.getElementById("reportBodySummary").innerHTML = `
    ${renderSummaryRow("Age", valueOrFallback(data.age))}
    ${renderSummaryRow("Height", data.heightText)}
    ${renderSummaryRow("Weight", data.weightText, `(${data.idealWeightText})`)}
    ${renderSummaryRow("Body Fat %", data.bodyFatText, data.bodyFatNormal)}
    ${renderSummaryRow("Visceral Fat", data.visceralFatText, "Normal 1-9")}
    ${renderSummaryRow("BMI", `${data.reportBmiText} (${data.reportBmiCategory})`, "Normal 18.5-24.9")}
    ${renderSummaryRow("BMR", valueOrFallback(data.bmr))}
    ${renderSummaryRow("Body Age", valueOrFallback(data.bodyAge))}
  `;

  const selectedConditions = [...data.selectedConditions];
  if (data.otherCondition) {
    selectedConditions.push(data.otherCondition);
  }

  const conditionsBox = document.getElementById("reportConditions");
  conditionsBox.classList.toggle("compact", selectedConditions.length > 8);
  conditionsBox.innerHTML = selectedConditions.length
    ? selectedConditions.map((item) => `<div class="report-condition-item">${escapeHtml(item)}</div>`).join("")
    : `<div class="report-condition-item muted">No health condition selected</div>`;

}

function renderReportRow(label, value) {
  return `
    <div class="report-info-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(valueOrFallback(value))}</strong>
    </div>
  `;
}

function renderSummaryRow(label, value, subValue = "") {
  const hasSubValue = subValue && subValue !== "--";
  return `
    <div class="summary-row">
      <div class="main-line">${escapeHtml(label)} - ${escapeHtml(valueOrFallback(value))}</div>
      ${hasSubValue ? `<div class="sub-line">${escapeHtml(subValue)}</div>` : ""}
    </div>
  `;
}

function collectData() {
  const height = getNumber("height");
  const weight = getNumber("weight");
  const autoBmi = calculateBmi(height, weight);
  const manualBmi = getNumber("bmi");
  const reportBmi = manualBmi ?? autoBmi;
  const idealWeight = calculateIdealWeight(height);
  const selectedConditions = Array.from(document.querySelectorAll('input[name="healthConditions"]:checked')).map((input) => input.value);
  const programDuration = getNumber("programDuration");
  const totalAmount = (programDuration ?? 0) * PROGRAM_RATE;

  return {
    name: getValue("name"),
    mobile: getValue("mobile"),
    date: getValue("date"),
    inviteBy: getValue("inviteBy"),
    coachName: getValue("coachName"),
    coachNumber: getValue("coachNumber"),
    gender: getRadioValue("gender"),
    age: getValue("age"),
    height: getValue("height"),
    weight: getValue("weight"),
    bodyFat: getValue("bodyFat"),
    visceralFat: getValue("visceralFat"),
    bmi: getValue("bmi"),
    bmr: getValue("bmr"),
    bodyAge: getValue("bodyAge"),
    wakeUpTime: getValue("wakeUpTime"),
    teaCoffee: getRadioValue("teaCoffee"),
    numberOfCups: getValue("numberOfCups"),
    breakfastTime: getValue("breakfastTime"),
    breakfastWhat: getValue("breakfastWhat"),
    lunchTime: getValue("lunchTime"),
    lunchWhat: getValue("lunchWhat"),
    snacks: getRadioValue("snacks"),
    snacksWhat: getValue("snacksWhat"),
    dinnerTime: getValue("dinnerTime"),
    dinnerWhat: getValue("dinnerWhat"),
    foodPreference: Array.from(document.querySelectorAll('input[name="foodPreference"]:checked')).map((input) => input.value),
    waterIntake: getValue("waterIntake"),
    otherCondition: getValue("otherCondition"),
    programDuration: getValue("programDuration"),
    selectedConditions,
    autoBmi,
    reportBmi,
    reportBmiCategory: getBmiCategory(reportBmi),
    bodyFatNormal: getBodyFatNormalRange(),
    heightText: height === null ? "--" : `${formatNumber(height)} cm`,
    weightText: weight === null ? "Weight - --" : `${formatNumber(weight)} kg`,
    idealWeightText: idealWeight === null ? "Ideal -- kg" : `Ideal ${formatNumber(idealWeight)} kg`,
    bodyFatText: valueWithUnit(getValue("bodyFat"), "%"),
    visceralFatText: valueOrFallback(getValue("visceralFat")),
    reportBmiText: reportBmi === null ? "--" : formatNumber(reportBmi),
    totalAmount,
  };
}

function persistData() {
  const payload = {};
  const elements = Array.from(form.elements);

  elements.forEach((field) => {
    if (!field.name) {
      return;
    }

    if (field.type === "radio") {
      if (field.checked) {
        payload[field.name] = field.value;
      }
      return;
    }

    if (field.type === "checkbox") {
      if (!Array.isArray(payload[field.name])) {
        payload[field.name] = [];
      }
      if (field.checked) {
        payload[field.name].push(field.value);
      }
      return;
    }

    payload[field.name] = field.value;
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return;
  }

  try {
    const payload = JSON.parse(saved);

    Array.from(form.elements).forEach((field) => {
      if (!field.name || payload[field.name] === undefined) {
        return;
      }

      if (field.type === "radio") {
        field.checked = payload[field.name] === field.value;
        return;
      }

      if (field.type === "checkbox") {
        field.checked = Array.isArray(payload[field.name]) && payload[field.name].includes(field.value);
        return;
      }

      field.value = payload[field.name];
    });
  } catch (error) {
    console.error("Unable to restore saved data.", error);
  }
}

function resetForm() {
  const confirmed = window.confirm("This will clear all saved and current data. Continue?");
  if (!confirmed) {
    return;
  }

  form.reset();
  localStorage.removeItem(STORAGE_KEY);
  seedToday();
  updateUi();
  setStep(0);
}

function setStep(stepIndex) {
  currentStep = Math.max(0, Math.min(stepIndex, steps.length - 1));
  syncStepUi();

  if (currentStep === steps.length - 1) {
    renderReport();
  }
}

function syncStepUi() {
  stepButtons.forEach((button, index) => {
    const active = index === currentStep;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });

  steps.forEach((panel, index) => {
    panel.hidden = index !== currentStep;
    panel.classList.toggle("active", index === currentStep);
  });

  currentStepLabel.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  prevButton.disabled = currentStep === 0;
  nextButton.disabled = currentStep === steps.length - 1;
}

function downloadPdf() {
  setStep(3);

  if (typeof window.html2pdf === "undefined") {
    window.print();
    return;
  }

  const filename = buildPdfFileName();
  const options = {
    margin: [0.1, 0.1, 0.1, 0.1],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#f5f7f1" },
    jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all"] },
    enableLinks: true,
  };

  window.html2pdf().set(options).from(reportSheet).save();
}

function buildPdfFileName() {
  const name = getValue("name").trim().replace(/\s+/g, "-").toLowerCase() || "client-report";
  return `${name}-gs-healthy-community-report.pdf`;
}

function calculateIdealWeight(height) {
  return height === null ? null : Math.max(height - 100, 0);
}

function calculateBmi(height, weight) {
  if (height === null || weight === null || height <= 0) {
    return null;
  }

  const meters = height / 100;
  return weight / (meters * meters);
}

function getBmiCategory(bmi) {
  if (bmi === null || Number.isNaN(bmi)) {
    return "--";
  }
  if (bmi < 18.5) {
    return "Underweight";
  }
  if (bmi < 25) {
    return "Normal";
  }
  if (bmi < 30) {
    return "Overweight";
  }
  return "Obese";
}

function getBodyFatNormalRange() {
  const gender = getRadioValue("gender");
  if (gender === "Male") {
    return "Normal 10-20%";
  }
  if (gender === "Female") {
    return "Normal 20-30%";
  }
  return "Normal 10-20% / 20-30%";
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}

function getNumber(id) {
  const value = getValue(id);
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function formatNumber(value) {
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function formatDisplayDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function valueOrFallback(value) {
  return value === null || value === undefined || value === "" ? "--" : String(value);
}

function valueWithUnit(value, unit) {
  return value ? `${value}${unit}` : "--";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
