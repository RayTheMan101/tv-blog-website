<?php
// Simple heartbeat endpoint to mark a viewer as alive or waiting
header('Content-Type: application/json');

// Database configuration
$host = 'localhost';
$dbname = 'bbccc_tv_account';
$db_username = 'root';
$db_password = '';

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!$data) { throw new Exception('Invalid JSON'); }

    $tv = isset($data['tv_number']) ? intval($data['tv_number']) : 0;
    $code = isset($data['connection_code']) ? trim($data['connection_code']) : '';
    $status = isset($data['status']) ? trim($data['status']) : 'alive';

    if ($tv <= 0) { throw new Exception('Missing tv_number'); }
    // For 'alive' we require a connection code; for 'waiting' we allow placeholder/empty
    if ($status === 'alive' && $code === '') { throw new Exception('Missing connection_code'); }

    $path = __DIR__ . '/viewer-heartbeats.json';
    $store = [];
    if (file_exists($path)) {
        $json = file_get_contents($path);
        $store = json_decode($json, true);
        if (!is_array($store)) { $store = []; }
    }

    $key = (string)$tv;
    if ($status === 'closed') {
        // Viewer is closing: remove heartbeat entry for instant disconnect
        if (isset($store[$key])) { unset($store[$key]); }
        
        // CRITICAL: Also delete the session from database to prevent reconnection
        try {
            $conn = new PDO("mysql:host=$host;dbname=$dbname", $db_username, $db_password);
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            $stmt = $conn->prepare("DELETE FROM tv_sessions WHERE tv_number = :tv_number AND connection_code = :connection_code");
            $stmt->execute([
                ':tv_number' => $tv,
                ':connection_code' => $code
            ]);
            
            $conn = null;
        } catch (PDOException $e) {
            // Log error but don't fail the request
            error_log('Failed to delete session: ' . $e->getMessage());
        }
    } else {
        $store[$key] = [
            'connection_code' => $code,
            'status' => $status,
            'timestamp' => time()
        ];
    }

    file_put_contents($path, json_encode($store));

    echo json_encode(['success' => true, 'message' => 'heartbeat saved']);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
