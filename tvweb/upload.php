<?php
// Upload handler for videos and pictures
// Supports up to 5 GB file uploads

// Increase limits if not already set higher
ini_set('upload_max_filesize', '5G');
ini_set('post_max_size', '5G');
ini_set('max_execution_time', 300); // 5 minutes
ini_set('max_input_time', 300); // 5 minutes

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

$type = $_POST['type'] ?? '';
$folder = $_POST['folder'] ?? 'content'; // Default to 'content' folder

$uploadDir = __DIR__ . '/uploads/' . $folder . '/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if (!in_array($type, ['video', 'picture'], true)) {
    echo json_encode(['success' => false, 'message' => 'Invalid type']);
    exit();
}

if (empty($_FILES['file'])) {
    echo json_encode(['success' => false, 'message' => 'No file uploaded']);
    exit();
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Upload error: ' . $file['error']]);
    exit();
}

$originalName = $file['name'];
$ext = pathinfo($originalName, PATHINFO_EXTENSION);
$ext = $ext ? '.' . $ext : '';
$safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));

// Check if a file with the same base name already exists in the folder
$existingFiles = glob($uploadDir . $safeName . '_*' . $ext);
if (!empty($existingFiles)) {
    echo json_encode([
        'success' => false,
        'message' => 'File already exists in ' . $folder,
        'duplicate' => true
    ]);
    exit();
}

$finalName = $safeName . '_' . time() . $ext;
$targetPath = $uploadDir . $finalName;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    echo json_encode(['success' => false, 'message' => 'Failed to save file']);
    exit();
}

echo json_encode([
    'success' => true,
    'message' => 'File uploaded',
    'filename' => $finalName
]);
exit();
?>
