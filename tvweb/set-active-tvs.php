<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['tvs']) || !is_array($data['tvs'])) {
    echo json_encode(['success' => false, 'error' => 'Invalid TV list']);
    exit();
}

// Write active TVs to file
$tvListFile = __DIR__ . '/active-tvs.json';
if (file_put_contents($tvListFile, json_encode($data['tvs']))) {
    echo json_encode([
        'success' => true,
        'message' => 'TV list updated',
        'tvs' => $data['tvs']
    ]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to save TV list']);
}
?>
