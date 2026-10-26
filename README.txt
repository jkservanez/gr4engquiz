ENGLISH PRACTICE QUIZ — GRADES 4–6

FILES
- index.html: page structure
- style.css: responsive design
- app.js: CSV loading, randomized quiz selection, timers, scoring, and review
- question-bank.csv: question bank data (990 rows)

HOW TO RUN
Do not open index.html directly with file:// because browsers commonly block fetch() from local files.
Run a local web server from this folder, for example:

  Python:
    python -m http.server 8000

Then visit:
  http://localhost:8000

You can also upload all four files to the same public web directory on your hosting account.
The CSV must be named exactly question-bank.csv and be in the same folder as index.html.

FEATURES
- Grade 4, Grade 5, Grade 6, or mixed Grades 4–6
- All, Easy, Medium, or Hard difficulty
- 10, 20, 30, 40, or 50 randomized questions
- No timer, overall timer, or per-question timer
- Duration presets: 20-minute Standard, 30-minute Relaxed, 15-minute Fast Paced, 10-minute Speed Challenge
- Answers and explanations appear after submission
- Results include score and difficulty breakdown

TIMER BEHAVIOR
- Overall timer: selected duration applies to the entire quiz.
- Per-question timer: selected duration is divided evenly by the number of questions in that session.
- No timer: no countdown is shown.

IMPORTANT SECURITY NOTE
This is a static front-end prototype. Because the browser downloads the CSV, students can technically inspect the CSV and see answer keys/explanations. For a public or high-stakes quiz, use a server-side PHP/WordPress endpoint to keep answer keys private and validate answers on the server.

EXPLANATION NOTE
The Explanation column is a concise, rule-based rationale generated from each question's category and keyed answer. Review and improve the explanations before using them as formal teaching feedback.


QUESTION BANK EXPANSION
- Expanded the bank to 258 distinct question rows.
- Deduplicated by grade, category, question wording, and passage ID.
- Difficulty labels are retained or assigned for newly added questions.

Final expansion audit: 990 question rows total. The target is 100 questions per grade in each of the first three categories and 30 reading-comprehension questions per grade.
