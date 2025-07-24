import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";


const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;
const saltRounds = 10;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "quiz-project-updated",
    password : "project",
    port: 5432,
});

db.connect();

app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));

app.get("/", (req, res)=>{
    res.sendFile("/index.html");
});

app.get("/login", (req, res)=>{
    res.sendFile("/login.html");
});


// this should be an ejs file
app.get("/public/teacher-quiz-create.html", (req, res)=>{
    res.sendFile(__dirname+"/public/teacher-quiz-create.html");
});

app.post("/quiz-type", async (req, res)=>{
    const output = req.body["quiz-type"];
    if(output==="private"){
        res.redirect("/student-private.html");
    }
    else{
        const quiz_data = await db.query("SELECT * FROM quiz_lists WHERE quiz_type_private = FALSE");
        console.log(quiz_data);
        res.render("student-public.ejs", {quiz_data: quiz_data});
    }
})

app.post("/signup", async (req, res)=>{
    try{
        //hashing password
    bcrypt.hash(req.body.password, saltRounds, async(err, hash)=>{
        if(err){
            console.log("Error hasing password: ", err);
        }else{
        await db.query("INSERT INTO teacher_details (email, pass, total_quiz) VALUES ($1, $2, $3)", [req.body["email"], hash, 0]);
        }    
    });

    //once signup is completed redirect to login page
    res.redirect("/teacher-login.html");
    }
    catch(err){
        // alert("An error occured!");
        console.log(err);
        res.redirect("/teacher-signup.html");
    }
});

let teacher_id;
//here we get email and password for teacher login
app.post("/login", async (req, res)=>{
    const input = req.body["email"];
    const loginPassword = req.body["password"];
    let  total_quiz_created;
    try{
        const output = await db.query("SELECT id, pass, total_quiz FROM teacher_details WHERE email=$1", [input]);
        const storedHashedPassword = output.rows[0]["pass"];
        bcrypt.compare(loginPassword, storedHashedPassword, async(err, result)=>{
            if(err){
                console.log("Error comparing passwords: ", err);
            }else{
                if(result){
                    teacher_id = output.rows[0]["id"];
            total_quiz_created = output.rows[0]["total_quiz"];
            const all_quizzes = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
            // console.log(all_quizzes);
            res.render("teacher-dashboard.ejs", {
                teacher_id: teacher_id,
                total_quiz_created: total_quiz_created,
                all_quizzes:all_quizzes
            });    
                }else{
                    res.redirect("/teacher-login.html");
                }
            }
        })
        // if(output.rows[0]["pass"]===req.body["password"]){
        //     teacher_id = output.rows[0]["id"];
        //     total_quiz_created = output.rows[0]["total_quiz"];
        //     const all_quizzes = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
        //     // console.log(all_quizzes);
        //     res.render("teacher-dashboard.ejs", {
        //         teacher_id: teacher_id,
        //         total_quiz_created: total_quiz_created,
        //         all_quizzes:all_quizzes
        //     });    
        // }
        // else{
        //     // err.message("You entered Incorrect password!");
        //     // console.log(err);
        //     res.redirect("/teacher-login.html");
        // }
    }
    catch(err){
        // err.message("Such email doesn't exist");
        console.log(err);
        res.redirect("/teacher-signup.html");
    }
});

app.post("/teacher-dashboard", async (req, res)=>{
    const total_quiz_created = await db.query("SELECT * FROM teacher_details WHERE id = $1", [teacher_id]);
    const all_quizzes = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
    // console.log(all_quizzes);
    res.render("teacher-dashboard.ejs", {
        teacher_id: teacher_id, 
        total_quiz_created:total_quiz_created.rows[0].total_quiz,
        all_quizzes:all_quizzes
    });
});

app.post("/teacher-quiz-create", (req, res)=>{
    res.redirect("/teacher-quiz-create.html");
});

app.post("/teacher-view-quizzes", async (req, res)=>{
    try{
    const view_quiz = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
    res.render("teacher-view-quizzes.ejs", {view_quiz: view_quiz, teacher_id: teacher_id});
    }
    catch(err){
        console.log(err);
        res.render("/teacher-dashboard.ejs", {teacher_id: teacher_id,
            total_quiz_created: total_quiz_created});
    }
});

app.post("/teacher-view-results", async(req, res)=>{
    try{
        const quiz_info = await db.query("SELECT id, quiz_name, quiz_type_private, total_attempts, reviews, subject FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
        const all_results = await db.query("SELECT * FROM student_attempt_lists WHERE teacher_id = $1", [teacher_id]);
        console.log(quiz_info.rows);
        console.log(all_results.rows);
        
        res.render("teacher-view-results.ejs", {all_results: all_results, teacher_id: teacher_id, quiz_info: quiz_info});
    }
    catch(err){
        console.log(err);
        res.redirect("/teacher-dashboard.ejs", {teacher_id: teacher_id,
            total_quiz_created: total_quiz_created,});
    }
});


let quiz, quiz_code;
app.post("/quizcode" , async (req, res)=>{
    try{
        quiz = await db.query("SELECT * FROM quiz_lists WHERE id=$1",[req.body["quiz-code"]] );
        quiz_code = req.body["quiz-code"];
        // console.log(quiz);
        console.log(quiz.rows[0].questions);
        if(typeof quiz.rows[0].questions === 'string'){
            quiz.rows[0].questions = JSON.parse(quiz.rows[0].questions);
        }
        res.render("quiz.ejs", {
            quiz: quiz, 
            questions: quiz.rows[0].questions,
            quiz_code: quiz_code,
        });
    }catch(err){
        console.log(err);
        res.redirect("/student-private.html");
    }    
});

app.post("/quiz-submit", async(req, res)=>{
    let score = 0;
    let total = 0;
    //checking answers
    let correct_answers = [];
    let correct_questions = [];
    let wrong_answers = [];
    let wrong_questions = [];
    let rating = Number(req.body["quiz-rating"]);
    let student_age = Number(req.body["student-age"]);
    for(let i=0; i<quiz.rows[0].questions.length; i++){
        let question_no = `question${i+1}`;
        if(req.body[`question${i+1}`].toLowerCase()===quiz.rows[0].questions[i]["answer"].toLowerCase()){
            score = score+1;
            correct_answers.push(quiz.rows[0].questions[i]["answer"]);
            correct_questions.push(quiz.rows[0].questions[i]["question"]);
        }
        else{
            wrong_answers.push(quiz.rows[0].questions[i]["answer"]);
            wrong_questions.push(quiz.rows[0].questions[i]["question"]);
        }
        total = total+1;
    }
    const accuracy = Math.round((score/total)*100)/100;
    // console.log(accuracy);
    const teacher_id = await db.query("SELECT teacher_id FROM quiz_lists WHERE id = $1", [quiz_code]);
    // console.log(teacher_id.rows[0].teacher_id);
    await db.query("INSERT INTO student_attempt_lists (name, age, review, quiz_id, teacher_id, correct_answers, total_questions, accuracy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
         [req.body["student-name"], student_age, rating, quiz_code, teacher_id.rows[0].teacher_id, score, total, accuracy]);

    let attempts = await db.query("SELECT total_attempts FROM quiz_lists WHERE id = $1", [quiz_code]);  
    let reviews = await db.query("SELECT reviews FROM quiz_lists WHERE id = $1", [quiz_code]);
    reviews = reviews.rows[0]["reviews"];
    attempts = attempts.rows[0]["total_attempts"];
    
    if(reviews===0){
        reviews = rating;
    }else{
        reviews = (((reviews*attempts) + rating)/(attempts+1));
        reviews = Math.round(reviews*100)/100;
    }
    await db.query("UPDATE quiz_lists SET total_attempts = $1, reviews = $2 WHERE id = $3", [attempts+1, reviews, quiz_code]);
    
    res.render("results.ejs", {
        score: score, 
        total: total, 
        accuracy: accuracy, 
        correct_answers: correct_answers, 
        wrong_answers: wrong_answers,
        wrong_questions: wrong_questions,
        correct_questions : correct_questions,
    });
});

app.post("/result-done", (req, res)=>{
    res.redirect("/index.html");
});

app.post("/quizzes", async(req,res)=>{
    const quizdata = req.body;
    console.log(quizdata);
    let vis = false;
    if(quizdata.type==="private"){
        vis = true;
    }
    var quiz_questions = [];
    quizdata.questions.forEach(ques=>{
        var q = {};
        q.type = ques.type==='short'? "SHORT" : "MCQ";
        q.answer = ques.correctAnswer;
        q.options = [];
        if(ques.options.length!=0){
            ques.options.forEach(option=>{
                q.options.push(option);
            });
        }
        q.question = ques.question;
        quiz_questions.push(q);
    });
    
    await db.query("INSERT INTO quiz_lists (quiz_name, quiz_type_private, teacher_id, total_attempts, reviews, questions, subject) VALUES ($1, $2, $3, $4, $5, $6, $7)", 
        [quizdata.name, vis, teacher_id, 0, 0, JSON.stringify(quiz_questions), quizdata.subject]
    );
    
    var quiz_count = await db.query("SELECT total_quiz FROM teacher_details WHERE id = $1", [teacher_id]);
    quiz_count = (quiz_count.rows[0].total_quiz) + 1;
    await db.query("UPDATE teacher_details SET total_quiz = $1 WHERE id = $2", [quiz_count, teacher_id]);
    
    // const total_quiz_created = await db.query("SELECT * FROM teacher_details WHERE id = $1", [teacher_id]);
    // const all_quizzes = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
    // // console.log(all_quizzes);
    // res.render("teacher-dashboard.ejs", {
    //     teacher_id: teacher_id, 
    //     total_quiz_created:total_quiz_created.rows[0].total_quiz,
    //     all_quizzes:all_quizzes
    // });
});

app.post("/delete-quiz", async (req, res)=>{
    await db.query("DELETE FROM quiz_lists WHERE id=$1", [req.body["quiz-code"]]);
    const view_quiz = await db.query("SELECT * FROM quiz_lists WHERE teacher_id = $1", [teacher_id]);
    res.render("teacher-view-quizzes.ejs", {view_quiz: view_quiz, teacher_id: teacher_id});
});


app.post("/logout", (req, res)=>{
    teacher_id=null;
    res.redirect("/");
});

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
});