import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

// PostgreSQL DB config using environment variables
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Render's SSL
  }
});


db.connect();

app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.get("/public/teacher-quiz-create.html", (req, res) => {
  res.sendFile(__dirname + "/public/teacher-quiz-create.html");
});

app.post("/quiz-type", async (req, res) => {
  const output = req.body["quiz-type"];
  if (output === "private") {
    res.redirect("/student-private.html");
  } else {
    const quiz_data = await db.query("SELECT * FROM quiz_lists WHERE quiz_type_private = FALSE");
    res.render("student-public.ejs", { quiz_data: quiz_data });
  }
});

app.post("/signup", async (req, res) => {
  try {
    bcrypt.hash(req.body.password, saltRounds, async (err, hash) => {
      if (err) {
        console.log("Error hashing password: ", err);
      } else {
        await db.query(
          "INSERT INTO teacher_details (email, pass, total_quiz) VALUES ($1, $2, $3)",
          [req.body["email"], hash, 0]
        );
      }
    });
    res.redirect("/teacher-login.html");
  } catch (err) {
    console.log(err);
    res.redirect("/teacher-signup.html");
  }
});

let teacher_id;

app.post("/login", async (req, res) => {
  const input = req.body["email"];
  const loginPassword = req.body["password"];
  try {
    const output = await db.query("SELECT id, pass, total_quiz FROM teacher_details WHERE email=$1", [input]);
    const storedHashedPassword = output.rows[0]["pass"];

    bcrypt.compare(loginPassword, storedHashedPassword, async (err, result) => {
      if (err) {
        console.log("Error comparing passwords: ", err);
      } else {
        if (result) {
          teacher_id = output.rows[0]["id"];
          const total_quiz_created = output.rows[0]["total_quiz"];
          const all_quizzes = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
          res.render("teacher-dashboard.ejs", {
            teacher_id: teacher_id,
            total_quiz_created: total_quiz_created,
            all_quizzes: all_quizzes,
          });
        } else {
          res.redirect("/teacher-login.html");
        }
      }
    });
  } catch (err) {
    console.log(err);
    res.redirect("/teacher-signup.html");
  }
});

app.post("/teacher-dashboard", async (req, res) => {
  const total_quiz_created = await db.query("SELECT * FROM teacher_details WHERE id = $1", [teacher_id]);
  const all_quizzes = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
  res.render("teacher-dashboard.ejs", {
    teacher_id: teacher_id,
    total_quiz_created: total_quiz_created.rows[0].total_quiz,
    all_quizzes: all_quizzes,
  });
});

app.post("/teacher-quiz-create", (req, res) => {
  res.redirect("/public/teacher-quiz-create.html");
});

app.post("/teacher-view-quizzes", async (req, res) => {
  try {
    const view_quiz = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
    res.render("teacher-view-quizzes.ejs", { view_quiz: view_quiz, teacher_id: teacher_id });
  } catch (err) {
    console.log(err);
    res.redirect("/teacher-dashboard.ejs");
  }
});

app.post("/teacher-view-results", async (req, res) => {
  try {
    const quiz_info = await db.query(
      "SELECT id, quiz_name, quiz_type_private, total_attempts, reviews, subject FROM quiz_lists WHERE teacher_id = $1",
      [teacher_id]
    );
    const all_results = await db.query(
      "SELECT * FROM student_attempt_lists WHERE teacher_id = $1",
      [teacher_id]
    );
    res.render("teacher-view-results.ejs", {
      all_results: all_results,
      teacher_id: teacher_id,
      quiz_info: quiz_info,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/teacher-dashboard.ejs");
  }
});

let quiz, quiz_code;

app.post("/quizcode", async (req, res) => {
  try {
    quiz = await db.query("SELECT * FROM quiz_lists WHERE id=$1", [req.body["quiz-code"]]);
    quiz_code = req.body["quiz-code"];
    if (typeof quiz.rows[0].questions === "string") {
      quiz.rows[0].questions = JSON.parse(quiz.rows[0].questions);
    }
    res.render("quiz.ejs", {
      quiz: quiz,
      questions: quiz.rows[0].questions,
      quiz_code: quiz_code,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/student-private.html");
  }
});

app.post("/quiz-submit", async (req, res) => {
  let score = 0;
  let total = 0;
  let correct_answers = [];
  let correct_questions = [];
  let wrong_answers = [];
  let wrong_questions = [];
  let rating = Number(req.body["quiz-rating"]);
  let student_age = Number(req.body["student-age"]);

  for (let i = 0; i < quiz.rows[0].questions.length; i++) {
    let q = quiz.rows[0].questions[i];
    let userAnswer = req.body[`question${i + 1}`]?.toLowerCase();
    if (userAnswer === q["answer"].toLowerCase()) {
      score++;
      correct_answers.push(q["answer"]);
      correct_questions.push(q["question"]);
    } else {
      wrong_answers.push(q["answer"]);
      wrong_questions.push(q["question"]);
    }
    total++;
  }

  const accuracy = Math.round((score / total) * 100) / 100;

  const teacher = await db.query("SELECT teacher_id FROM quiz_lists WHERE id = $1", [quiz_code]);
  const teacherId = teacher.rows[0].teacher_id;

  await db.query(
    "INSERT INTO student_attempt_lists (name, age, review, quiz_id, teacher_id, correct_answers, total_questions, accuracy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [req.body["student-name"], student_age, rating, quiz_code, teacherId, score, total, accuracy]
  );

  let attempts = await db.query("SELECT total_attempts FROM quiz_lists WHERE id = $1", [quiz_code]);
  let reviews = await db.query("SELECT reviews FROM quiz_lists WHERE id = $1", [quiz_code]);

  reviews = reviews.rows[0]["reviews"];
  attempts = attempts.rows[0]["total_attempts"];

  reviews =
    reviews === 0
      ? rating
      : Math.round(((reviews * attempts + rating) / (attempts + 1)) * 100) / 100;

  await db.query(
    "UPDATE quiz_lists SET total_attempts = $1, reviews = $2 WHERE id = $3",
    [attempts + 1, reviews, quiz_code]
  );

  res.render("results.ejs", {
    score,
    total,
    accuracy,
    correct_answers,
    wrong_answers,
    wrong_questions,
    correct_questions,
  });
});

app.post("/result-done", (req, res) => {
  res.redirect("/index.html");
});

app.post("/quizzes", async (req, res) => {
  const quizdata = req.body;
  let vis = quizdata.type === "private";
  const quiz_questions = quizdata.questions.map((q) => ({
    type: q.type === "short" ? "SHORT" : "MCQ",
    question: q.question,
    answer: q.correctAnswer,
    options: q.options,
  }));

  await db.query(
    "INSERT INTO quiz_lists (quiz_name, quiz_type_private, teacher_id, total_attempts, reviews, questions, subject) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [quizdata.name, vis, teacher_id, 0, 0, JSON.stringify(quiz_questions), quizdata.subject]
  );

  let quiz_count = await db.query("SELECT total_quiz FROM teacher_details WHERE id = $1", [teacher_id]);
  quiz_count = quiz_count.rows[0].total_quiz + 1;

  await db.query("UPDATE teacher_details SET total_quiz = $1 WHERE id = $2", [quiz_count, teacher_id]);
});

app.post("/delete-quiz", async (req, res) => {
  await db.query("DELETE FROM quiz_lists WHERE id=$1", [req.body["quiz-code"]]);
  const view_quiz = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
  res.render("teacher-view-quizzes.ejs", { view_quiz: view_quiz, teacher_id: teacher_id });
});

app.post("/logout", (req, res) => {
  teacher_id = null;
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
