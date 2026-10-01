<?php
// Fetch current TV state for connected devices
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
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

if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'GET') {
    $connection_code = trim($_GET['connection_code'] ?? $_POST['connection_code'] ?? '');

    if (!$connection_code) {
        echo json_encode([
            'success' => false,
            'message' => 'Connection code is required'
        ]);
        exit();
    }

    try {
        // Some databases may not have all optional columns; select core fields only
        $stmt = $conn->prepare("SELECT id, tv_number, connection_code, current_video, current_picture, play_status 
                   FROM tv_sessions WHERE connection_code = :connection_code LIMIT 1");
        $stmt->execute([':connection_code' => $connection_code]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($session) {
            // Check if optional columns exist (volume, speed, fullscreen, timestamp)
            $volume = 1.0;
            $speed = 1.0;
            $fullscreen = null;
            $timestamp = 0;
            try {
                $colCheckV = $conn->query("SHOW COLUMNS FROM tv_sessions LIKE 'video_volume'");
                $colCheckS = $conn->query("SHOW COLUMNS FROM tv_sessions LIKE 'playback_speed'");
                $colCheckF = $conn->query("SHOW COLUMNS FROM tv_sessions LIKE 'fullscreen_request'");
                $colCheckT = $conn->query("SHOW COLUMNS FROM tv_sessions LIKE 'video_timestamp'");
                if ($colCheckV && $colCheckV->rowCount() > 0 &&
                    $colCheckS && $colCheckS->rowCount() > 0 &&
                    $colCheckF && $colCheckF->rowCount() > 0 &&
                    $colCheckT && $colCheckT->rowCount() > 0) {
                    $stmtAlt = $conn->prepare("SELECT video_volume, playback_speed, fullscreen_request, video_timestamp FROM tv_sessions WHERE connection_code = :connection_code");
                    $stmtAlt->execute([':connection_code' => $connection_code]);
                    $extra = $stmtAlt->fetch(PDO::FETCH_ASSOC);
                    if ($extra) {
                        $volume = floatval($extra['video_volume'] ?? 1.0);
                        $speed = floatval($extra['playback_speed'] ?? 1.0);
                        $fullscreen = $extra['fullscreen_request'] ?? null;
                        $timestamp = floatval($extra['video_timestamp'] ?? 0);
                    }
                }
            } catch (PDOException $e) {
                // Columns don't exist, use defaults
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'tv_number' => $session['tv_number'],
                    'connection_code' => $session['connection_code'],
                    'current_video' => $session['current_video'],
                    'current_picture' => $session['current_picture'],
                    'play_status' => $session['play_status'],
                    'video_timestamp' => $timestamp,
                    'video_volume' => $volume,
                    'playback_speed' => $speed,
                    'fullscreen_request' => $fullscreen
                ]
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Invalid connection code or session not found',
                'disconnected' => true
            ]);
        }
    } catch(PDOException $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching state: ' . $e->getMessage()
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
