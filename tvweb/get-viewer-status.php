<?php
// Returns whether a TV viewer has sent a recent heartbeat
header('Content-Type: application/json');

$tv = isset($_GET['tv']) ? intval($_GET['tv']) : 0;
$code = isset($_GET['code']) ? trim($_GET['code']) : '';
$maxAge = isset($_GET['maxAge']) ? intval($_GET['maxAge']) : 15; // seconds

if ($tv <= 0) {
    echo json_encode(['success' => false, 'message' => 'tv required']);
    exit;
}

$path = __DIR__ . '/viewer-heartbeats.json';
if (!file_exists($path)) {
    echo json_encode(['success' => true, 'connected' => false, 'lastSeen' => null]);
    exit;
}

$data = json_decode(file_get_contents($path), true);
if (!is_array($data)) { $data = []; }
$key = (string)$tv;

if (!isset($data[$key])) {
    echo json_encode(['success' => true, 'connected' => false, 'lastSeen' => null]);
    exit;
}

$entry = $data[$key];
$last = isset($entry['timestamp']) ? intval($entry['timestamp']) : 0;
$now = time();
$age = $last > 0 ? ($now - $last) : 99999;

// If a code was provided, require it to match (prevents stale heartbeats from old sessions)
$codeMatches = $code === '' || ($entry['connection_code'] ?? '') === $code;
$connected = ($age <= $maxAge) && $codeMatches;

echo json_encode([
    'success' => true,
    'connected' => $connected,
    'lastSeen' => $last,
    'age' => $age,
]);
