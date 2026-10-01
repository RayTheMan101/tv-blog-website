<?php
// User Authentication Backend - Validates login credentials against database
// Returns user info if username and password match

error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Database configuration
$host = 'localhost';
$dbname = 'bbccc_tv_account';   // User's database name
$db_username = 'root';   // Default XAMPP username
$db_password = '';       // Default XAMPP password is empty

// Create database connection
try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname", $db_username, $db_password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit();
}

// Handle POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    // Validation - ensure username and password are provided
    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Username and password are required'
        ]);
        exit();
    }

    // Query user from database
    $stmt = $conn->prepare("SELECT id, username, password, role FROM users WHERE username = :username LIMIT 1");
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Check if user exists
    if (!$user) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Account not found'
        ]);
    } elseif ($password !== $user['password']) {
        // Check if password matches
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid password'
        ]);
    } else {
        // Login successful - return user data
        echo json_encode([
            'success' => true,
            'message' => 'Login successful',
            'id' => $user['id'],
            'username' => $user['username'],
            'role' => $user['role']
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request method'
    ]);
}

$conn = null;
?>
