<?php
// Delete uploaded file
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
$filename = $input['filename'] ?? '';
$folder = $input['folder'] ?? 'content';

if (!$filename) {
    echo json_encode(['success' => false, 'message' => 'Invalid parameters']);
    exit();
}

$uploadDir = __DIR__ . '/uploads/' . $folder . '/';
$filePath = realpath($uploadDir . $filename);

// Basic path traversal guard
if (!$filePath || strpos($filePath, realpath($uploadDir)) !== 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid file path']);
    exit();
}

if (!file_exists($filePath)) {
    echo json_encode(['success' => false, 'message' => 'File not found']);
    exit();
}

// Check if the file is currently being played on any TV
$host = 'localhost';
$dbname = 'bbccc_tv_account';
$db_username = 'root';
$db_password = '';

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname", $db_username, $db_password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM tv_sessions WHERE current_video = :filename OR current_picture = :filename");
    $stmt->execute([':filename' => $filename]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result['count'] > 0) {
        echo json_encode(['success' => false, 'message' => 'Cannot delete: This file is currently playing on a TV']);
        exit();
    }
} catch(PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    exit();
}

if (!unlink($filePath)) {
    echo json_encode(['success' => false, 'message' => 'Failed to delete file']);
    exit();
}

echo json_encode(['success' => true, 'message' => 'File deleted']);
exit();
?>
