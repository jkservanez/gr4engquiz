const $ = (id) => document.getElementById(id);
const state = {
  bank: [],
  quiz: [],
  answers: {},
  index: 0,
  timerMode: "none",
  durationSeconds: 1200,
  remainingSeconds: 1200,
  questionSeconds: 0,
  questionRemaining: 0,
  timerHandle: null,
  finished: false
};

const OPTION_KEYS = ["A", "B", "C", "D"];
const CSV_HEADERS = {
  id: "Question_ID", grade: "Grade_Level", category: "Category",
  difficulty: "Difficulty", passageId: "Passage_ID", passage: "Passage",
  question: "Question", correct: "Correct_Answer", correctText: "Correct_Answer_Text",
  explanation: "Explanation"
};

function parseCSV(text) {
  const records = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else {
      if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); records.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
  }
  if (cell.length || row.length) { row.push(cell); records.push(row); }
  if (!records.length) return [];
  const headers = records.shift().map(h => h.trim().replace(/^\uFEFF/, ""));
  return records.filter(r => r.some(v => v !== "")).map(values => {
    const item = {};
    headers.forEach((h, i) => item[h] = values[i] ?? "");
    return item;
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function safeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function categoryLabel(category) {
  return String(category || "").replace(/ MCQ$/, "");
}

function updateTimerSettings() {
  const mode = $("timer-mode").value;
  $("duration-field").classList.toggle("hidden", mode === "none");
  const count = Number($("question-count").value);
  const mins = Number($("duration").value);
  if (mode === "none") $("timer-hint").textContent = "No timer: take as long as you need.";
  else if (mode === "overall") $("timer-hint").textContent = `Overall timer: ${mins} minutes for the entire quiz.`;
  else $("timer-hint").textContent = `Per-question timer: each question gets ${(mins * 60 / count).toFixed(0)} seconds, based on the selected total duration divided by ${count} questions.`;
}

async function loadBank() {
  try {
    const response = await fetch("question-bank.csv", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load question-bank.csv (HTTP ${response.status}).`);
    const text = await response.text();
    state.bank = parseCSV(text);
    if (!state.bank.length) throw new Error("The CSV has no question rows.");
    $("bank-status").textContent = `Question bank loaded: ${state.bank.length} questions available.`;
    $("bank-status").classList.remove("error");
    $("start-button").disabled = false;
    $("start-button").textContent = "Start quiz";
  } catch (error) {
    $("bank-status").textContent = `${error.message} Place index.html, app.js, style.css, and question-bank.csv in the same folder and open through a local web server or hosted website.`;
    $("bank-status").classList.add("error");
    $("start-button").disabled = true;
    $("start-button").textContent = "Question bank unavailable";
  }
}

function buildQuiz() {
  const grade = $("grade").value;
  const difficulty = $("difficulty").value;
  const count = Number($("question-count").value);
  let pool = state.bank.filter(q => {
    const gradeMatch = grade === "all" || String(q.Grade_Level).trim() === grade;
    const difficultyMatch = difficulty === "all" || String(q.Difficulty).trim().toLowerCase() === difficulty.toLowerCase();
    return gradeMatch && difficultyMatch;
  });
  if (!pool.length) {
    alert("No questions match these settings. Try another grade or difficulty.");
    return false;
  }
  if (pool.length < count) {
    const useCount = pool.length;
    alert(`Only ${useCount} questions match these settings. The quiz will use all ${useCount} available questions.`);
  }
  state.quiz = shuffle(pool).slice(0, Math.min(count, pool.length));
  state.answers = {};
  state.index = 0;
  state.finished = false;
  state.timerMode = $("timer-mode").value;
  state.durationSeconds = Number($("duration").value) * 60;
  state.remainingSeconds = state.durationSeconds;
  state.questionSeconds = Math.max(1, Math.floor(state.durationSeconds / state.quiz.length));
  state.questionRemaining = state.questionSeconds;
  return true;
}

function startQuiz(event) {
  event.preventDefault();
  if (!buildQuiz()) return;
  $("setup-screen").classList.add("hidden");
  $("results-screen").classList.add("hidden");
  $("quiz-screen").classList.remove("hidden");
  $("timer-display").classList.toggle("hidden", state.timerMode === "none");
  renderQuestion();
  startTimer();
}

function renderQuestion() {
  const q = state.quiz[state.index];
  const gradeText = $("grade").value === "all" ? "GRADES 4–6" : `GRADE ${$("grade").value}`;
  const diffText = $("difficulty").value === "all" ? "ALL DIFFICULTIES" : $("difficulty").value.toUpperCase();
  $("quiz-meta").textContent = `${gradeText} · ${diffText}`;
  $("quiz-title").textContent = `Question ${state.index + 1}`;
  $("progress-text").textContent = `Question ${state.index + 1} of ${state.quiz.length}`;
  $("answered-text").textContent = `${Object.keys(state.answers).length} answered`;
  $("progress-bar").style.width = `${((state.index + 1) / state.quiz.length) * 100}%`;
  $("category-tag").textContent = categoryLabel(q.Category);
  const difficulty = safeText(q.Difficulty || "Medium");
  $("difficulty-tag").textContent = difficulty;
  $("difficulty-tag").className = `tag ${difficulty.toLowerCase()}`;
  const passage = safeText(q.Passage);
  $("passage").textContent = passage;
  $("passage").classList.toggle("hidden", !passage);
  $("question-text").textContent = safeText(q.Question);
  const selected = state.answers[state.index];
  $("options").replaceChildren();
  OPTION_KEYS.forEach(key => {
    const value = safeText(q[`Option_${key}`]);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `option${selected === key ? " selected" : ""}`;
    button.setAttribute("aria-pressed", selected === key ? "true" : "false");
    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = key;
    const text = document.createElement("span");
    text.textContent = value;
    button.append(letter, text);
    button.addEventListener("click", () => {
      state.answers[state.index] = key;
      renderQuestion();
    });
    $("options").append(button);
  });
$("next-button").textContent = state.index === state.quiz.length - 1 ? "Finish questions" : "Next question";
  if (state.timerMode === "per-question") {
    state.questionRemaining = Math.min(state.questionRemaining || state.questionSeconds, state.questionSeconds);
    renderTimer(state.questionRemaining);
  } else if (state.timerMode === "overall") renderTimer(state.remainingSeconds);
}

function startTimer() {
  clearInterval(state.timerHandle);
  if (state.timerMode === "none") return;
  if (state.timerMode === "per-question") {
    state.questionRemaining = state.questionSeconds;
    renderTimer(state.questionRemaining);
  } else {
    renderTimer(state.remainingSeconds);
  }
  state.timerHandle = setInterval(() => {
    if (state.finished) return;
    if (state.timerMode === "overall") {
      state.remainingSeconds -= 1;
      renderTimer(state.remainingSeconds);
      if (state.remainingSeconds <= 0) finishQuiz(true);
    } else if (state.timerMode === "per-question") {
      state.questionRemaining -= 1;
      renderTimer(state.questionRemaining);
      if (state.questionRemaining <= 0) {
        if (state.index < state.quiz.length - 1) {
          state.index += 1;
          state.questionRemaining = state.questionSeconds;
          renderQuestion();
        } else finishQuiz(true);
      }
    }
  }, 1000);
}

function renderTimer(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  $("timer-display").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  $("timer-display").classList.toggle("warning", safeSeconds <= 120 && safeSeconds > 30);
  $("timer-display").classList.toggle("danger", safeSeconds <= 30);
}

function goNext() {
  if (state.index < state.quiz.length - 1) {
    state.index += 1;
    if (state.timerMode === "per-question") state.questionRemaining = state.questionSeconds;
    renderQuestion();
  } else {
    openEndQuizModal();
  }
}

function openEndQuizModal() {
  $("end-quiz-modal").classList.remove("hidden");
  $("confirm-end-button").focus();
}
function closeEndQuizModal() {
  $("end-quiz-modal").classList.add("hidden");
  $("end-quiz-button").focus();
}
function confirmEndQuiz() {
  closeEndQuizModal();
  finishQuiz(false);
}

function finishQuiz(timeExpired = false) {
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timerHandle);
  $("quiz-screen").classList.add("hidden");
  $("results-screen").classList.remove("hidden");
  const correctCount = state.quiz.reduce((total, q, i) => total + (state.answers[i] === safeText(q.Correct_Answer).toUpperCase() ? 1 : 0), 0);
  const total = state.quiz.length;
  const percent = Math.round((correctCount / total) * 100);
  $("score-number").textContent = `${correctCount}/${total}`;
  $("score-percent").textContent = `${percent}%`;
  $("result-summary").textContent = timeExpired ? "Time is up. Here are your results." : "Your answers have been submitted. Review each answer and explanation below.";
  const diffCounts = { Easy: { total: 0, correct: 0 }, Medium: { total: 0, correct: 0 }, Hard: { total: 0, correct: 0 } };
  state.quiz.forEach((q, i) => {
    const d = safeText(q.Difficulty || "Medium");
    if (!diffCounts[d]) diffCounts[d] = { total: 0, correct: 0 };
    diffCounts[d].total++;
    if (state.answers[i] === safeText(q.Correct_Answer).toUpperCase()) diffCounts[d].correct++;
  });
  $("score-breakdown").replaceChildren();
  Object.entries(diffCounts).forEach(([difficulty, result]) => {
    if (!result.total) return;
    const span = document.createElement("span");
    span.textContent = `${difficulty}: ${result.correct}/${result.total}`;
    $("score-breakdown").append(span);
  });
  renderReview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderReview() {
  $("review-list").replaceChildren();
  state.quiz.forEach((q, i) => {
    const correctKey = safeText(q.Correct_Answer).toUpperCase();
    const chosenKey = state.answers[i] || "";
    const isCorrect = chosenKey === correctKey;
    const article = document.createElement("article");
    article.className = `review-item ${isCorrect ? "correct" : "incorrect"}`;
    const meta = document.createElement("p");
    meta.className = "review-meta";
    meta.textContent = `QUESTION ${i + 1} · ${safeText(q.Grade_Level) ? "GRADE " + safeText(q.Grade_Level) : "GRADE"} · ${safeText(q.Difficulty)} · ${isCorrect ? "CORRECT" : "INCORRECT / UNANSWERED"}`;
    const title = document.createElement("h4");
    title.textContent = safeText(q.Question);
    article.append(meta);
    if (safeText(q.Passage)) {
      const p = document.createElement("p");
      p.className = "review-passage";
      p.textContent = safeText(q.Passage);
      article.append(p);
    }
    article.append(title);
    const yourAnswer = document.createElement("p");
    yourAnswer.className = "review-answer";
    yourAnswer.textContent = `Your answer: ${chosenKey ? chosenKey + ". " + safeText(q["Option_" + chosenKey]) : "Not answered"}`;
    const correctAnswer = document.createElement("p");
    correctAnswer.className = "review-answer";
    correctAnswer.innerHTML = `<strong>Correct answer:</strong> `;
    const correctText = document.createElement("span");
    correctText.textContent = `${correctKey}. ${safeText(q["Option_" + correctKey])}`;
    correctAnswer.append(correctText);
    const explanation = document.createElement("div");
    explanation.className = "explanation";
    const explanationTitle = document.createElement("strong");
    explanationTitle.textContent = "Explanation: ";
    const explanationText = document.createElement("span");
    explanationText.textContent = safeText(q.Explanation) || `The correct answer is ${safeText(q["Option_" + correctKey])}.`;
    explanation.append(explanationTitle, explanationText);
    article.append(yourAnswer, correctAnswer, explanation);
    $("review-list").append(article);
  });
}

function showSetup() {
  clearInterval(state.timerHandle);
  state.finished = true;
  $("results-screen").classList.add("hidden");
  $("quiz-screen").classList.add("hidden");
  $("setup-screen").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("setup-form").addEventListener("submit", startQuiz);
$("timer-mode").addEventListener("change", updateTimerSettings);
$("question-count").addEventListener("change", updateTimerSettings);
$("duration").addEventListener("change", updateTimerSettings);
$("next-button").addEventListener("click", goNext);
$("end-quiz-button").addEventListener("click", openEndQuizModal);
$("cancel-end-button").addEventListener("click", closeEndQuizModal);
$("confirm-end-button").addEventListener("click", confirmEndQuiz);
$("end-quiz-modal").addEventListener("click", (event) => {
  if (event.target === $("end-quiz-modal")) closeEndQuizModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("end-quiz-modal").classList.contains("hidden")) closeEndQuizModal();
});
$("retry-button").addEventListener("click", () => {
  $("results-screen").classList.add("hidden");
  $("setup-screen").classList.remove("hidden");
  $("bank-status").textContent = `Question bank loaded: ${state.bank.length} questions available.`;
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("setup-again-button").addEventListener("click", showSetup);
updateTimerSettings();
loadBank();
