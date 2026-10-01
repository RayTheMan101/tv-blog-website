<?php
// Disconnect a TV session by connection_code or tv_number
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

$inputRaw = file_get_contents('php://input');
$input = json_decode($inputRaw, true);

$connection_code = $input['connection_code'] ?? null;
$tv_number = isset($input['tv_number']) ? intval($input['tv_number']) : null;

if (!$connection_code && !$tv_number) {
    echo json_encode(['success' => false, 'message' => 'Missing connection_code or tv_number']);
    exit();
}

// Database configuration
$host = 'localhost';
$dbname = 'bbccc_tv_account';
$db_username = 'root';
$db_password = '';

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname", $db_username, $db_password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if ($connection_code) {
        $stmt = $conn->prepare("DELETE FROM tv_sessions WHERE connection_code = :connection_code");
        $stmt->execute([':connection_code' => $connection_code]);
    } else {
        $stmt = $conn->prepare("DELETE FROM tv_sessions WHERE tv_number = :tv_number");
        $stmt->execute([':tv_number' => $tv_number]);
    }

    echo json_encode(['success' => true, 'message' => 'Disconnected']);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>