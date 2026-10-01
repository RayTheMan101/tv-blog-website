<?php
// Clear deleted file from all active TV sessions
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Database configuration
$host = 'localhost';
$dbname = 'bbccc_tv_account';
$db_username = 'root';
$db_password = '';

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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $filename = trim($data['filename'] ?? '');
    $content_type = trim($data['content_type'] ?? '');
    $folder = trim($data['folder'] ?? 'content');

    if (!$filename || !$content_type) {
        echo json_encode([
            'success' => false,
            'message' => 'Filename and content_type are required'
        ]);
        exit();
    }

    try {
        // Determine which field to clear based on content type
        $field = ($content_type === 'video') ? 'current_video' : 'current_picture';
        
        // Build the full path as stored in database (folder/filename)
        $fullPath = $folder . '/' . $filename;
        
        // Update all sessions that have this file as current content
        $stmt = $conn->prepare("
            UPDATE tv_sessions 
            SET $field = NULL, play_status = 'stopped' 
            WHERE $field = :filename
        ");
        
        $stmt->execute([':filename' => $fullPath]);
        
        $rowsAffected = $stmt->rowCount();

        echo json_encode([
            'success' => true,
            'message' => 'Cleared from ' . $rowsAffected . ' session(s)',
            'rows_affected' => $rowsAffected
        ]);
    } catch(PDOException $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error clearing from sessions: ' . $e->getMessage()
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
