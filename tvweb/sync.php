<?php
// Update TV state (video/picture changes, play status)
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
    
    $connection_code = trim($data['connection_code'] ?? '');
    $clear_all = $data['clear_all'] ?? false;
    $content_type = $data['content_type'] ?? ''; // 'video' or 'picture'
    $filename = trim($data['filename'] ?? '');
    $folder = $data['folder'] ?? 'content'; // 'content' or 'slideshow'
    $play_status = $data['play_status'] ?? null; // 'playing', 'paused', 'stopped'
    $video_timestamp = $data['video_timestamp'] ?? 0;
    $video_volume = $data['video_volume'] ?? null; // 0.0 to 1.0
    $playback_speed = $data['playback_speed'] ?? null; // 0.5 to 2.0 typical
    $fullscreen_request = $data['fullscreen_request'] ?? null; // 'enter' or 'exit'
    $tv_number_req = isset($data['tv_number']) ? intval($data['tv_number']) : null;

    if (!$connection_code) {
        echo json_encode([
            'success' => false,
            'message' => 'Connection code is required'
        ]);
        exit();
    }

    try {
        $updateData = [':connection_code' => $connection_code];
        $updateQuery = "UPDATE tv_sessions SET ";
        $updates = [];

        // Check optional columns existence (avoid errors if schema not migrated)
        $hasVolume = false;
        $hasSpeed = false;
        $hasFullscreen = false;
        try {
            $colV = $conn->query("SHOW COLUMNS FROM tv_sessions LIKE 'video_volume'");
            $colS = $conn->query("SHOW COLUMNS FROM tv_sessions LIKE 'playback_speed'");
            $colF = $conn->query("SHOW COLUMNS FROM tv_sessions LIKE 'fullscreen_request'");
            $hasVolume = $colV && $colV->rowCount() > 0;
            $hasSpeed = $colS && $colS->rowCount() > 0;
            $hasFullscreen = $colF && $colF->rowCount() > 0;
        } catch (PDOException $e) {
            // ignore
        }

        // Handle clear_all to reset content
        if ($clear_all) {
            $updates[] = "current_video = NULL";
            $updates[] = "current_picture = NULL";
            $updates[] = "play_status = 'stopped'";
        } else {
            // Handle content updates - prepend folder to filename
            if ($content_type === 'video' && $filename) {
                $fullPath = $folder . '/' . $filename;
                $updates[] = "current_video = :filename";
                $updates[] = "current_picture = NULL";
                $updateData[':filename'] = $fullPath;
            } elseif ($content_type === 'picture' && $filename) {
                $fullPath = $folder . '/' . $filename;
                $updates[] = "current_picture = :filename";
                $updates[] = "current_video = NULL";
                $updateData[':filename'] = $fullPath;
            }
        }

        // Handle play_status updates
        if ($play_status !== null && in_array($play_status, ['playing', 'paused', 'stopped'])) {
            $updates[] = "play_status = :play_status";
            $updateData[':play_status'] = $play_status;
        }

        if ($video_timestamp !== null && is_numeric($video_timestamp)) {
            $updates[] = "video_timestamp = :video_timestamp";
            $updateData[':video_timestamp'] = floatval($video_timestamp);
        }

        // Handle volume updates
        if ($video_volume !== null && $hasVolume) {
            $volume = floatval($video_volume);
            if ($volume >= 0.0 && $volume <= 1.0) {
                $updates[] = "video_volume = :video_volume";
                $updateData[':video_volume'] = $volume;
            }
        }

        // Handle playback speed updates
        if ($playback_speed !== null && $hasSpeed) {
            $speed = floatval($playback_speed);
            if ($speed > 0.0) {
                $updates[] = "playback_speed = :playback_speed";
                $updateData[':playback_speed'] = $speed;
            }
        }

        // Handle fullscreen request if column exists
        if ($fullscreen_request !== null && $hasFullscreen) {
            if (in_array($fullscreen_request, ['enter', 'exit']) || $fullscreen_request === null || $fullscreen_request === '') {
                $updates[] = "fullscreen_request = :fullscreen_request";
                $updateData[':fullscreen_request'] = ($fullscreen_request === '' || $fullscreen_request === null) ? null : $fullscreen_request;
            }
        }

        if (empty($updates)) {
            echo json_encode([
                'success' => false,
                'message' => 'No updates provided'
            ]);
            exit();
        }

        $updateQuery .= implode(", ", $updates) . " WHERE connection_code = :connection_code";

        $stmt = $conn->prepare($updateQuery);
        $stmt->execute($updateData);

        // Fallback: update by tv_number if provided and connection_code didn't match
        if ($stmt->rowCount() === 0 && $tv_number_req) {
            $updateDataFallback = $updateData;
            unset($updateDataFallback[':connection_code']);
            $updateDataFallback[':tv_number'] = $tv_number_req;
            $updateQueryFallback = str_replace(' WHERE connection_code = :connection_code', ' WHERE tv_number = :tv_number', $updateQuery);
            $stmtFallback = $conn->prepare($updateQueryFallback);
            $stmtFallback->execute($updateDataFallback);
            if ($stmtFallback->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'TV state updated successfully'
                ]);
                $conn = null;
                exit();
            }
        }

        if ($stmt->rowCount() > 0) {
            echo json_encode([
                'success' => true,
                'message' => 'TV state updated successfully'
            ]);
        } else {
            // If nothing changed, verify session exists and treat as success (no-op)
            try {
                $check = $conn->prepare('SELECT id FROM tv_sessions WHERE connection_code = :connection_code LIMIT 1');
                $check->execute([':connection_code' => $connection_code]);
                if ($check->fetch(PDO::FETCH_ASSOC)) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'No changes applied'
                    ]);
                } else if ($tv_number_req) {
                    $check2 = $conn->prepare('SELECT id FROM tv_sessions WHERE tv_number = :tv_number LIMIT 1');
                    $check2->execute([':tv_number' => $tv_number_req]);
                    if ($check2->fetch(PDO::FETCH_ASSOC)) {
                        echo json_encode([
                            'success' => true,
                            'message' => 'No changes applied'
                        ]);
                    } else {
                        echo json_encode([
                            'success' => false,
                            'message' => 'Invalid connection code or session not found'
                        ]);
                    }
                } else {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Invalid connection code or session not found'
                    ]);
                }
            } catch (PDOException $e) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Error updating state: ' . $e->getMessage()
                ]);
            }
        }
    } catch(PDOException $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error updating state: ' . $e->getMessage()
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
