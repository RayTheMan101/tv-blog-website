<?php
// Rename uploaded file
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

$input = json_decode(file_get_contents('php://input'), true);
$oldFilename = $input['oldFilename'] ?? '';
$newName = $input['newName'] ?? '';
$type = $input['type'] ?? '';
$folder = $input['folder'] ?? 'content';

if (!$oldFilename || !$newName) {
    echo json_encode(['success' => false, 'message' => 'Invalid parameters']);
    exit();
}

// Validate new name - only allow alphanumeric, spaces, dashes, and underscores
if (!preg_match('/^[a-zA-Z0-9\s\-_.]+$/', $newName)) {
    echo json_encode(['success' => false, 'message' => 'Invalid filename. Only alphanumeric, spaces, dashes, and underscores allowed']);
    exit();
}

$uploadsDir = __DIR__ . '/uploads/' . $folder . '/';
$oldFilePath = realpath($uploadsDir . $oldFilename);

// Basic path traversal guard
if (!$oldFilePath || strpos($oldFilePath, realpath($uploadsDir)) !== 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid file path']);
    exit();
}

if (!file_exists($oldFilePath)) {
    echo json_encode(['success' => false, 'message' => 'File not found']);
    exit();
}

// Preserve file extension
$ext = pathinfo($oldFilePath, PATHINFO_EXTENSION);
$newBase = trim($newName);
$newFilename = $newBase . '.' . $ext;
$newFilePath = $uploadsDir . $newFilename;

// If target exists, auto-uniquify by appending _1, _2, ...
if (file_exists($newFilePath)) {
    $counter = 1;
    do {
        $candidate = $newBase . '_' . $counter . '.' . $ext;
        $candidatePath = $uploadsDir . $candidate;
        if (!file_exists($candidatePath)) {
            $newFilename = $candidate;
            $newFilePath = $candidatePath;
            break;
        }
        $counter++;
    } while (true);
}

// Rename the file
if (!rename($oldFilePath, $newFilePath)) {
    echo json_encode(['success' => false, 'message' => 'Failed to rename file']);
    exit();
}

echo json_encode([
    'success' => true,
    'message' => 'File renamed successfully',
    'newFilename' => $newFilename
]);
exit();
?>
