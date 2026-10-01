<?php
header('Content-Type: application/json');

try {
    // Get the JSON payload
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['filename']) || !isset($data['type']) || !isset($data['sourceFolder'])) {
        throw new Exception('Missing required parameters');
    }

    $filename = $data['filename'];
    $type = $data['type'];
    $sourceFolder = $data['sourceFolder'];

    // Validate type
    if (!in_array($type, ['video', 'picture'])) {
        throw new Exception('Invalid file type');
    }

    // Define paths
    $sourcePath = __DIR__ . '/uploads/' . $sourceFolder . '/' . $filename;
    $destPath = __DIR__ . '/uploads/slideshow/' . $filename;

    // Check if source file exists
    if (!file_exists($sourcePath)) {
        throw new Exception('Source file not found');
    }

    // Check if file already exists in slideshow folder
    if (file_exists($destPath)) {
        echo json_encode(array(
            'success' => false,
            'message' => 'File already exists in slideshow',
            'alreadyExists' => true
        ));
        exit();
    }

    // Create slideshow directory if it doesn't exist
    $slideshowDir = __DIR__ . '/uploads/slideshow/';
    if (!is_dir($slideshowDir)) {
        mkdir($slideshowDir, 0755, true);
    }

    // Copy the file to slideshow folder
    if (!copy($sourcePath, $destPath)) {
        throw new Exception('Failed to copy file');
    }

    echo json_encode(array(
        'success' => true,
        'message' => 'File copied to slideshow successfully'
    ));
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(array(
        'success' => false,
        'message' => $e->getMessage(),
        'alreadyExists' => false
    ));
}
?>
