document.getElementById('signup-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting traditionally
  
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
  
    // Simple email and password validation
    if (!email || !password) {
      alert("Please fill out both email and password fields.");
      return;
    }
  
    // Additional validation for email format
    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailPattern.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }
  
    // If everything is valid, submit the form or send data to backend (using AJAX for example)
    alert("Signup successful!");
    // Here you would typically send the data to the backend via an API call
  });
  