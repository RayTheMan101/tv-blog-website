<?php
// Generate connection code for TV synchronization
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
    $tv_number = $data['tv_number'] ?? 0;
    $force_new = isset($data['force_new']) ? (bool)$data['force_new'] : false;

    if (!$tv_number || !is_numeric($tv_number) || $tv_number < 1) {
        echo json_encode([
            'success' => false,
            'message' => 'Invalid TV number'
        ]);
        exit();
    }

    // Reuse existing session if present unless force_new is requested
    try {
        if (!$force_new) {
            // Check if there's an active viewer heartbeat for this TV
            $heartbeatPath = __DIR__ . '/viewer-heartbeats.json';
            $hasActiveViewer = false;
            
            if (file_exists($heartbeatPath)) {
                $heartbeatJson = file_get_contents($heartbeatPath);
                $heartbeats = json_decode($heartbeatJson, true);
                
                if (is_array($heartbeats) && isset($heartbeats[(string)$tv_number])) {
                    $heartbeat = $heartbeats[(string)$tv_number];
                    $timeDiff = time() - $heartbeat['timestamp'];
                    
                    // If heartbeat is less than 10 seconds old, viewer is still active
                    if ($timeDiff < 10) {
                        $hasActiveViewer = true;
                    }
                }
            }
            
            // If no active viewer heartbeat, force a new connection
            if (!$hasActiveViewer) {
                $force_new = true;
            } else {
                // Viewer is active, try to reuse existing session
                $existingStmt = $conn->prepare("SELECT connection_code, tv_number FROM tv_sessions WHERE tv_number = :tv_number LIMIT 1");
                $existingStmt->execute([':tv_number' => $tv_number]);
                $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    // Refresh created_at so get-viewer-code treats this as fresh
                    $refreshStmt = $conn->prepare("UPDATE tv_sessions SET created_at = NOW() WHERE tv_number = :tv_number");
                    $refreshStmt->execute([':tv_number' => $tv_number]);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Existing connection reused',
                        'connection_code' => $existing['connection_code'],
                        'tv_number' => $existing['tv_number']
                    ]);
                    exit();
                }
            }
        }

        if ($force_new) {
            $deleteStmt = $conn->prepare("DELETE FROM tv_sessions WHERE tv_number = :tv_number");
            $deleteStmt->execute([':tv_number' => $tv_number]);
        }

        // Generate new short connection code (TV#-XXX format where XXX is 3 random digits)
        $randomDigits = str_pad(mt_rand(0, 999), 3, '0', STR_PAD_LEFT);
        $connection_code = 'TV' . $tv_number . '-' . $randomDigits;

        $stmt = $conn->prepare("INSERT INTO tv_sessions (tv_number, connection_code, play_status, video_volume, playback_speed) 
                               VALUES (:tv_number, :connection_code, 'stopped', 1.0, 1.0)");
        $stmt->execute([
            ':tv_number' => $tv_number,
            ':connection_code' => $connection_code
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Connection code generated',
            'connection_code' => $connection_code,
            'tv_number' => $tv_number
        ]);
    } catch(PDOException $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error creating session: ' . $e->getMessage()
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
