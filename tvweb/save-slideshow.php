<?php
header('Content-Type: application/json');

try {
    // Get the JSON payload
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['slideshow']) || !isset($data['slideshowOrder'])) {
        throw new Exception('Missing slideshow data');
    }

    // Path to slideshow data file
    $slideshowFile = __DIR__ . '/slideshow-data.json';
    
    // Save the slideshow data
    $slideshowData = array(
        'slideshow' => $data['slideshow'],
        'slideshowOrder' => $data['slideshowOrder'],
        'lastUpdated' => date('Y-m-d H:i:s')
    );
    
    file_put_contents($slideshowFile, json_encode($slideshowData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    
    echo json_encode(array(
        'success' => true,
        'message' => 'Slideshow saved successfully'
    ));
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(array(
        'success' => false,
        'message' => $e->getMessage()
    ));
}
?>
