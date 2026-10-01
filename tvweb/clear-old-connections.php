<?php
// Clear old TV1 and TV2 connection codes
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

// Database configuration
$host = 'localhost';
$dbname = 'bbccc_tv_account';
$db_username = 'root';
$db_password = '';

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname", $db_username, $db_password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Delete old connection codes for TV1 and TV2
    $stmt = $conn->prepare("DELETE FROM tv_sessions WHERE tv_number IN (1, 2)");
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => 'Old connection codes cleared',
        'rows_deleted' => $stmt->rowCount()
    ]);
} catch(Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>
