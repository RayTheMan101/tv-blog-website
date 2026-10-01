<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Read active TVs from file
$tvListFile = __DIR__ . '/active-tvs.json';

if (file_exists($tvListFile)) {
    $tvs = json_decode(file_get_contents($tvListFile), true);
    if (!is_array($tvs)) {
        $tvs = [1, 2];
    }
} else {
    // Default to TV1 and TV2
    $tvs = [1, 2];
}

echo json_encode([
    'success' => true,
    'tvs' => $tvs
]);
?>
