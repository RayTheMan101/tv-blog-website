<?php
// Check upload configuration limits
header('Content-Type: application/json');

$uploadMax = ini_get('upload_max_filesize');
$postMax = ini_get('post_max_size');
$memoryLimit = ini_get('memory_limit');

// Convert to bytes for comparison
function getBytes($val) {
    $val = trim($val);
    $last = strtolower($val[strlen($val)-1]);
    $val = (int)$val;
    switch($last) {
        case 'g': $val *= 1024;
        case 'm': $val *= 1024;
        case 'k': $val *= 1024;
    }
    return $val;
}

$uploadBytes = getBytes($uploadMax);
$postBytes = getBytes($postMax);

// The actual limit is the smaller of upload_max_filesize and post_max_size
$actualLimit = min($uploadBytes, $postBytes);
$actualLimitMB = round($actualLimit / (1024 * 1024), 2);

echo json_encode([
    'upload_max_filesize' => $uploadMax,
    'post_max_size' => $postMax,
    'memory_limit' => $memoryLimit,
    'actual_limit_mb' => $actualLimitMB,
    'limiting_factor' => $uploadBytes <= $postBytes ? 'upload_max_filesize' : 'post_max_size'
]);
?>
