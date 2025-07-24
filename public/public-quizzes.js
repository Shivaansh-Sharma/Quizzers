document.addEventListener("DOMContentLoaded", function() {
  const quizList = document.getElementById("quiz-list");

  // Fetch public quizzes (Mocked for demo purpose)
  const quizzes = [
    { name: "Math Quiz", id: "12345" },
    { name: "Science Quiz", id: "67890" }
  ];

  quizzes.forEach(quiz => {
    const quizElement = document.createElement("div");
    quizElement.classList.add("quiz");
    quizElement.innerHTML = `<a href="quiz.html?id=${quiz.id}">${quiz.name}</a>`;
    quizList.appendChild(quizElement);
  });
});
