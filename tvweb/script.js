// Login and Signup Form Handler
// Manages form switching animation and database authentication

const wrapper = document.querySelector('.wrapper');
const registerLink = document.querySelector('.register-link');
const loginLink = document.querySelector('.login-link');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// Switch to signup form
registerLink.onclick = () => {
    wrapper.classList.add('active');
}

// Switch to login form
loginLink.onclick = () => {
    wrapper.classList.remove('active');
}

// Handle Login Form Submission - sends credentials to login.php
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('login.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store user data in localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('username', data.username);
            localStorage.setItem('role', data.role);
            localStorage.setItem('userId', data.id);
            
            // Redirect to TV Management page
            window.location.href = 'tv-management.html';
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during login');
    }
});

// Handle Sign Up Form Submission - creates new user account via signup.php
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirm').value;
    
    if (!username || !password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch('signup.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Account created successfully! Please login.');
            // Switch back to login form
            wrapper.classList.remove('active');
            signupForm.reset();
            loginForm.reset();
        } else {
            alert(data.message || 'Sign up failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during sign up');
    }
});
