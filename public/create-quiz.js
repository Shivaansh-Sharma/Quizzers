document.getElementById("create-quiz-form").addEventListener("submit", function(event) {
    event.preventDefault();
  
    const quizName = document.getElementById("quiz-name").value;
    const quizType = document.getElementById("quiz-type").value;
    const questionsText = document.getElementById("questions").value;
  
    try {
      const questions = JSON.parse(questionsText); // Assuming questions are submitted in JSON format
  
      if (!Array.isArray(questions)) {
        throw new Error("Questions should be an array.");
      }
  
      alert(`Quiz "${quizName}" created successfully!`);
  
      window.location.href = "teacher-dashboard.html"; // Replace with actual page
    } catch (error) {
      alert("Error: " + error.message);
    }
  });
  