<?php
// Check if a TV is already connected to another device
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $tv_number = isset($_GET['tv']) ? intval($_GET['tv']) : 0;
    
    if ($tv_number <= 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid TV number'
        ]);
        exit();
    }

    // Check if there's an active heartbeat for this TV (within last 10 seconds)
    $path = __DIR__ . '/viewer-heartbeats.json';
    $isConnected = false;
    
    if (file_exists($path)) {
        $json = file_get_contents($path);
        $store = json_decode($json, true);
        
        if (is_array($store)) {
            $key = (string)$tv_number;
            if (isset($store[$key])) {
                $heartbeat = $store[$key];
                $timeDiff = time() - $heartbeat['timestamp'];
                $status = isset($heartbeat['status']) ? $heartbeat['status'] : 'alive';
                
                // Consider connected/waiting if heartbeat is recent and status is waiting or alive
                if ($timeDiff < 10 && ($status === 'waiting' || $status === 'alive')) {
                    $isConnected = true;
                }
            }
        }
    }

    echo json_encode([
        'success' => true,
        'is_connected' => $isConnected
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
