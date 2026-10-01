<?php
// List uploaded videos and images from uploads folder
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Check if getTVs parameter is set
if (isset($_GET['getTVs'])) {
    // Return list of active TVs from database
    $dbFile = __DIR__ . '/tvweb.db';
    try {
        $pdo = new PDO("sqlite:$dbFile");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // Get all unique TV numbers from sessions
        $stmt = $pdo->query("SELECT DISTINCT tv_number FROM sessions WHERE tv_number > 0 ORDER BY tv_number");
        $tvs = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // If no TVs in database, return defaults
        if (empty($tvs)) {
            $tvs = [1, 2];
        }
        
        echo json_encode([
            'success' => true,
            'tvs' => $tvs
        ]);
    } catch (Exception $e) {
        // Default to TV1 and TV2 if database error
        echo json_encode([
            'success' => true,
            'tvs' => [1, 2]
        ]);
    }
    exit();
}

$videoExt = ['mp4','webm','ogg','mov','mkv','avi'];
$imageExt = ['jpg','jpeg','png','gif','bmp','webp'];

$videos = [];
$pictures = [];
$slideshowVideos = [];
$slideshowPictures = [];

// Function to scan directory
function scanUploadsDir($dir, &$videos, &$pictures) {
    global $videoExt, $imageExt;
    if (is_dir($dir)) {
        $files = scandir($dir);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            $path = $dir . $file;
            if (!is_file($path)) continue;
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

            $entry = ['name' => $file, 'filename' => $file];

            if (in_array($ext, $videoExt)) {
                $videos[] = $entry;
            } elseif (in_array($ext, $imageExt)) {
                $pictures[] = $entry;
            }
        }
    }
}

// Scan uploads/content folder
$contentDir = __DIR__ . '/uploads/content/';
scanUploadsDir($contentDir, $videos, $pictures);

// Scan uploads/slideshow folder
$slideshowDir = __DIR__ . '/uploads/slideshow/';
scanUploadsDir($slideshowDir, $slideshowVideos, $slideshowPictures);

echo json_encode([
    'success' => true,
    'videos' => $videos,
    'pictures' => $pictures,
    'slideshow' => [
        'videos' => $slideshowVideos,
        'pictures' => $slideshowPictures
    ]
]);
exit();
?>
