<?php
// Get connection code for a specific TV viewer
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Database configuration
$host = 'localhost';
$dbname = 'bbccc_tv_account';
$db_username = 'root';
$db_password = '';

$conn = null;

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname", $db_username, $db_password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $tv_number = intval($_GET['tv'] ?? 0);

    if (!$tv_number) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'TV number is required'
        ]);
        exit();
    }

    try {
        // Only return FRESH connection codes (clicked recently)
        // Prevent viewers from auto-connecting to stale sessions
        // Threshold: last 2 minutes
        $query = "SELECT connection_code, created_at FROM tv_sessions 
                            WHERE tv_number = :tv_number 
                                AND created_at >= (NOW() - INTERVAL 2 MINUTE)
                            ORDER BY created_at DESC 
                            LIMIT 1";
        
        $stmt = $conn->prepare($query);
        $stmt->execute([':tv_number' => $tv_number]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($session && !empty($session['connection_code'])) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'connection_code' => $session['connection_code']
            ]);
        } else {
            http_response_code(200);
            echo json_encode([
                'success' => false,
                'message' => 'No connection code found for TV ' . $tv_number
            ]);
        }
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching connection code: ' . $e->getMessage()
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request method'
    ]);
}

if ($conn) {
    $conn = null;
}
?>
