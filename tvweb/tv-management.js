// TV Management Dashboard - Controls TV content and connections
// Manages video/picture uploads, slideshows, and real-time TV connections
// Syncs with tv-viewer.js on remote devices

let connectionCodes = {}; // Stores connection codes for each TV
let isMainController = false;
let syncInterval = null;
let connectionStatus = {}; // Tracks if TV is currently connected
let lastHeartbeat = {}; // Tracks last heartbeat from each TV viewer
let heartbeatCheckInterval = null;
let pendingPreview = {}; // Stores preview state when TV disconnects
let activeTVs = []; // List of active TV numbers

document.addEventListener('DOMContentLoaded', function() {
    // Require user to be logged in - redirect if not authenticated
    if (!localStorage.getItem('isLoggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize content storage - separates content and slideshow items
    window.tvContent = {
        videos: [],
        pictures: [],
        slideshow: {
            videos: [],
            pictures: [],
            order: []  // Mixed videos and pictures order
        }
    };

    // Initialize global slideshow order tracker
    window.slideshowOrder = [];

    // Load slideshow order from browser storage if exists
    const savedOrder = localStorage.getItem('slideshowOrder');
    if (savedOrder) {
        window.slideshowOrder = JSON.parse(savedOrder);
    }

    // Load active TVs list from browser storage
    const savedTVs = localStorage.getItem('activeTVs');
    if (savedTVs) {
        activeTVs = JSON.parse(savedTVs);
    } else {
        activeTVs = [1, 2]; // Default: TV1 and TV2
        localStorage.setItem('activeTVs', JSON.stringify(activeTVs));
    }

    // Sync active TVs to server so TV viewers only see available TVs
    saveActiveTVsToServer();

    // Initialize connection codes for all active TVs
    activeTVs.forEach(tvNum => {
        const savedCode = localStorage.getItem(`connectionCodeTV${tvNum}`);
        if (savedCode) {
            connectionCodes[tvNum] = savedCode;
            connectionStatus[tvNum] = false;
            lastHeartbeat[tvNum] = null;
            pendingPreview[tvNum] = null;
            verifyAndRestoreConnection(tvNum, savedCode);
        } else {
            connectionCodes[tvNum] = null;
            connectionStatus[tvNum] = false;
            lastHeartbeat[tvNum] = null;
            pendingPreview[tvNum] = null;
        }
        // Initialize slideshow state for this TV
        initSlideshowState(tvNum);
    });

    // Render TV cards
    renderTVCards();
    
    // Load existing files from uploads folder into current content list
    loadUploads();

    // Video and picture upload handlers are now onclick handlers in HTML buttons
    // They use handleVideoUpload(folder) and handlePictureUpload(folder) functions

    // Start monitoring viewer heartbeat
    startHeartbeatMonitor();
    
    // Toggle chevron icon when collapsible is shown/hidden
    const contentCollapse = document.getElementById('contentListCollapse');
    if (contentCollapse) {
        contentCollapse.addEventListener('show.bs.collapse', function () {
            const btn = document.querySelector('[data-bs-target="#contentListCollapse"]');
            if (btn) {
                btn.innerHTML = '<i class="bi bi-chevron-up"></i> Hide Files';
            }
        });
        contentCollapse.addEventListener('hide.bs.collapse', function () {
            const btn = document.querySelector('[data-bs-target="#contentListCollapse"]');
            if (btn) {
                btn.innerHTML = '<i class="bi bi-chevron-down"></i> Show Files';
            }
        });
    }
    
    const slideshowCollapse = document.getElementById('slideshowListCollapse');
    if (slideshowCollapse) {
        slideshowCollapse.addEventListener('show.bs.collapse', function () {
            const btn = document.querySelector('[data-bs-target="#slideshowListCollapse"]');
            if (btn) {
                btn.innerHTML = '<i class="bi bi-chevron-up"></i> Hide Files';
            }
        });
        slideshowCollapse.addEventListener('hide.bs.collapse', function () {
            const btn = document.querySelector('[data-bs-target="#slideshowListCollapse"]');
            if (btn) {
                btn.innerHTML = '<i class="bi bi-chevron-down"></i> Show Files';
            }
        });
    }
});

function updateConnectionStatus(tv, connected) {
    connectionStatus[tv] = connected;
    const statusElement = document.getElementById(`statusTV${tv}`);
    if (statusElement) {
        if (connected) {
            statusElement.textContent = 'Connected';
            statusElement.className = 'badge bg-success';
        } else {
            statusElement.textContent = 'Not Connected';
            statusElement.className = 'badge bg-secondary';
        }
    }

    // Toggle Connect/Disconnect button visibility
    const connectBtn = document.getElementById(`connectBtnTV${tv}`);
    const disconnectBtn = document.getElementById(`disconnectBtnTV${tv}`);
    if (connectBtn && disconnectBtn) {
        if (connected) {
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
        } else {
            connectBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
        }
    }
}

function startHeartbeatMonitor() {
    if (heartbeatCheckInterval) clearInterval(heartbeatCheckInterval);
    heartbeatCheckInterval = setInterval(() => {
        const now = Date.now();
        [1, 2].forEach(tv => {
            if (connectionCodes[tv] && lastHeartbeat[tv]) {
                const elapsed = now - lastHeartbeat[tv];
                // If no heartbeat for 5 seconds, mark as disconnected
                if (elapsed > 5000 && connectionStatus[tv]) {
                    updateConnectionStatus(tv, false);
                }
            }
        });
    }, 2000);
}

function syncCurrentContentToViewer(tv, connectionCode) {
    const videoPlayer = document.getElementById(`videoPlayerTV${tv}`);
    const pictureViewer = document.getElementById(`pictureViewerTV${tv}`);
    
    // Check if video is playing
    if (videoPlayer && videoPlayer.src && videoPlayer.style.display !== 'none') {
        const filename = videoPlayer.src.split('/').pop();
        const playStatus = videoPlayer.paused ? 'paused' : 'playing';
        const timestamp = videoPlayer.currentTime || 0;
        
        fetch('sync.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                connection_code: connectionCode,
                tv_number: tv,
                content_type: 'video',
                filename: filename,
                play_status: playStatus,
                video_timestamp: timestamp,
                video_volume: videoPlayer.volume || 1.0,
                playback_speed: videoPlayer.playbackRate || 1.0
            })
        }).catch(err => console.error('Sync current content error:', err));
    }
    // Check if picture is showing
    else if (pictureViewer && pictureViewer.src && pictureViewer.style.display !== 'none') {
        const filename = pictureViewer.src.split('/').pop();
        
        fetch('sync.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                connection_code: connectionCode,
                tv_number: tv,
                content_type: 'picture',
                filename: filename,
                play_status: 'stopped'
            })
        }).catch(err => console.error('Sync current content error:', err));
    }
}


// Load existing uploads from server and populate list
function loadUploads() {
    fetch('list_uploads.php')
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error('List error:', data.message);
                return;
            }

            // Populate content from content folder
            window.tvContent.videos = data.videos;
            window.tvContent.pictures = data.pictures;

            // Populate slideshow from slideshow folder
            if (data.slideshow) {
                window.tvContent.slideshow.videos = data.slideshow.videos;
                window.tvContent.slideshow.pictures = data.slideshow.pictures;
            }

            // Rebuild slideshow order based on saved order or default order
            rebuildSlideshowOrder();
            
            updateContentList();
            
            // Initialize button UI after content is loaded and rendered
            activeTVs.forEach(tvNum => {
                setPlayPauseUI(tvNum, false); // Start in paused state
            });
        })
        .catch(error => console.error('List error:', error));
}

// Rebuild slideshow order from saved order or create new order
function rebuildSlideshowOrder() {
    const allFiles = [
        ...window.tvContent.slideshow.videos.map(v => ({ filename: v.filename, type: 'video' })),
        ...window.tvContent.slideshow.pictures.map(p => ({ filename: p.filename, type: 'picture' }))
    ];

    if (window.slideshowOrder.length === 0) {
        // No saved order, use default (videos first, then pictures)
        window.slideshowOrder = allFiles;
    } else {
        // Filter saved order to only include files that still exist
        window.slideshowOrder = window.slideshowOrder.filter(item => 
            allFiles.some(f => f.filename === item.filename && f.type === item.type)
        );
        
        // Add any new files that weren't in the saved order
        allFiles.forEach(file => {
            if (!window.slideshowOrder.some(item => item.filename === file.filename && item.type === file.type)) {
                window.slideshowOrder.push(file);
            }
        });
    }
}
// Generate connection code for main controller
function generateConnectionCode(tv) {
    fetch('connect.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tv_number: tv })
    })
    .then(async response => {
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            throw new Error(text || 'Server error');
        }

        if (data.success) {
            connectionCodes[tv] = data.connection_code;
            isMainController = true;

            // Display connection code
            const codeElement = document.getElementById(`connectionCodeTV${tv}`);
            const codeSpan = document.getElementById(`codeTV${tv}`);
            codeSpan.textContent = data.connection_code;
            codeElement.style.display = 'block';

            alert('Connection code generated! Share this code with other devices:\n\n' + data.connection_code);

            // Start syncing
            startSync(tv);
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Connection error:', error);
        alert('Error generating connection code: ' + error.message);
    });
}

// Connect to specific TV Viewer (1 or 2)
function connectToViewer(tvViewerNumber) {
    fetch('connect.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tv_number: tvViewerNumber })
    })
    .then(async response => {
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            throw new Error(text || 'Server error');
        }

        if (data.success) {
            const connectionCode = data.connection_code;
            
            // Store for management page to track
            connectionCodes[tvViewerNumber] = connectionCode;
            localStorage.setItem(`connectionCodeTV${tvViewerNumber}`, connectionCode);
            isMainController = true;
            
            // Hide old connection code display if shown
            const codeElement = document.getElementById(`connectionCodeTV${tvViewerNumber}`);
            if (codeElement) {
                codeElement.style.display = 'none';
            }
            
            // Verify connection by checking if viewer responds
            verifyViewerConnection(tvViewerNumber, connectionCode);
            
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Connection error:', error);
        alert('Error connecting to TV Viewer: ' + error.message);
    });
}

// Verify and restore connection after page refresh
function verifyAndRestoreConnection(tvViewerNumber, connectionCode) {
    fetch('get-sync.php?connection_code=' + encodeURIComponent(connectionCode) + '&tv=' + tvViewerNumber, {
        method: 'GET'
    })
    .then(async response => {
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            console.error('Parse error:', text);
            return;
        }

        if (data.success) {
            // Connection still active!
            updateConnectionStatus(tvViewerNumber, true);
            lastHeartbeat[tvViewerNumber] = Date.now();
            isMainController = true;
            
            // Restore playing content if any
            if (data.data.current_video || data.data.current_picture) {
                restoreViewerContent(tvViewerNumber, data.data);
            }
            
            // Start heartbeat polling for this TV
            startHeartbeatPolling(tvViewerNumber);
        } else {
            // Connection expired, clear it
            localStorage.removeItem(`connectionCodeTV${tvViewerNumber}`);
            connectionCodes[tvViewerNumber] = null;
            updateConnectionStatus(tvViewerNumber, false);
        }
    })
    .catch(error => {
        console.error('Restore connection error:', error);
        localStorage.removeItem(`connectionCodeTV${tvViewerNumber}`);
        connectionCodes[tvViewerNumber] = null;
        updateConnectionStatus(tvViewerNumber, false);
    });
}

// Restore viewer's current content to management player
function restoreViewerContent(tv, tvState) {
    const videoPlayerId = `videoPlayerTV${tv}`;
    const pictureViewerId = `pictureViewerTV${tv}`;
    const videoPlayer = document.getElementById(videoPlayerId);
    const pictureViewer = document.getElementById(pictureViewerId);

    if (tvState.current_video) {
        videoPlayer.src = 'uploads/' + tvState.current_video;
        if (tvState.video_volume !== undefined) {
            videoPlayer.volume = tvState.video_volume;
        }
        if (tvState.playback_speed !== undefined) {
            videoPlayer.playbackRate = tvState.playback_speed;
        }
        pictureViewer.style.display = 'none';
        videoPlayer.style.display = 'block';
        
        // Load and play immediately, then set timestamp
        videoPlayer.load();
        if (tvState.video_timestamp > 0) {
            videoPlayer.currentTime = tvState.video_timestamp;
        }
        const playPromise = videoPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.warn('Auto-play blocked:', err);
                // Retry after a short delay
                setTimeout(() => {
                    videoPlayer.play().catch(e => console.warn('Retry failed:', e));
                }, 500);
            });
        }
    } else if (tvState.current_picture) {
        pictureViewer.src = 'uploads/' + tvState.current_picture;
        pictureViewer.style.display = 'block';
        videoPlayer.style.display = 'none';
    }
}

// Silent reconnect - refreshes connection without showing alerts
function silentReconnect(tv) {
    fetch('connect.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ tv_number: tv })
    })
    .then(r => r.text())
    .then(text => {
        try {
            const data = JSON.parse(text);
            if (data.success) {
                connectionCodes[tv] = data.connection_code;
                localStorage.setItem(`connectionCodeTV${tv}`, data.connection_code);
                // Do not mark connected until heartbeat confirms
                updateConnectionStatus(tv, false);
                lastHeartbeat[tv] = null;
                startHeartbeatPolling(tv);
                console.log('Silent reconnect successful for TV ' + tv);
            }
        } catch (err) {
            console.error('Silent reconnect failed:', err);
        }
    })
    .catch(error => console.error('Silent reconnect error:', error));
}
function startHeartbeatPolling(tv) {
    const pollKey = `heartbeatPoll_${tv}`;
    
    // Clear existing polling for this TV
    if (window[pollKey]) {
        clearInterval(window[pollKey]);
    }
    
    // Poll every 500ms to check if viewer is still alive via heartbeat file
    window[pollKey] = setInterval(function() {
        const activeCode = connectionCodes[tv];
        if (!activeCode) {
            clearInterval(window[pollKey]);
            return;
        }

        fetch('get-viewer-status.php?tv=' + tv + '&code=' + encodeURIComponent(activeCode) + '&maxAge=2')
            .then(response => response.json())
            .then(data => {
                if (data && data.success) {
                    const connected = !!data.connected;
                    if (connected) {
                        lastHeartbeat[tv] = Date.now();
                        if (!connectionStatus[tv]) {
                            updateConnectionStatus(tv, true);
                        }
                    } else {
                        if (connectionStatus[tv]) {
                            updateConnectionStatus(tv, false);
                        }
                    }
                }
            })
            .catch(error => console.error('Heartbeat poll error:', error));
    }, 500);
}

// Verify if the TV Viewer is actually connected and responding
function verifyViewerConnection(tvViewerNumber, connectionCode) {
    // Wait a bit for viewer to pick up the code and start polling
    let attempts = 0;
    const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds
    
    // Set status to "Connecting" while waiting
    updateConnectionStatus(tvViewerNumber, false);
    const statusElement = document.getElementById(`statusTV${tvViewerNumber}`);
    if (statusElement) {
        statusElement.textContent = 'Connecting...';
        statusElement.className = 'badge bg-warning text-dark';
    }
    
    function checkConnection() {
        fetch('get-viewer-status.php?tv=' + tvViewerNumber + '&code=' + encodeURIComponent(connectionCode) + '&maxAge=2', {
            method: 'GET'
        })
        .then(async response => {
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error('Parse error:', text);
                return;
            }

            if (data.success && data.connected) {
                // Connection successful!
                updateConnectionStatus(tvViewerNumber, true);
                lastHeartbeat[tvViewerNumber] = Date.now();
                
                // If user was previewing locally while disconnected, push that starting at time 0
                const preview = pendingPreview[tvViewerNumber];
                if (preview) {
                    if (preview.type === 'video') {
                        const videoPlayer = document.getElementById(`videoPlayerTV${tvViewerNumber}`);
                        if (videoPlayer) {
                            try { videoPlayer.currentTime = 0; } catch (e) {}
                        }
                        updateTVState(tvViewerNumber, 'video', preview.filename);
                    } else if (preview.type === 'picture') {
                        updateTVState(tvViewerNumber, 'picture', preview.filename);
                    }
                    pendingPreview[tvViewerNumber] = null;
                } else {
                    // Sync current playing content if any
                    syncCurrentContentToViewer(tvViewerNumber, connectionCode);
                }
                
                // Start heartbeat polling for this TV
                startHeartbeatPolling(tvViewerNumber);
            } else {
                attempts++;
                if (attempts < maxAttempts) {
                    // Retry after 500ms
                    setTimeout(checkConnection, 500);
                } else {
                    // Connection failed after 10 seconds
                    updateConnectionStatus(tvViewerNumber, false);
                    const statusEl = document.getElementById(`statusTV${tvViewerNumber}`);
                    if (statusEl) {
                        statusEl.textContent = 'Not Connected';
                        statusEl.className = 'badge bg-secondary';
                    }
                    alert('Connection Timeout: No TV connection detected.');
                    // Disconnect and clean up
                    disconnectViewer(tvViewerNumber);
                }
            }
        })
        .catch(error => {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkConnection, 500);
            } else {
                // Connection failed after 10 seconds
                updateConnectionStatus(tvViewerNumber, false);
                const statusEl = document.getElementById(`statusTV${tvViewerNumber}`);
                if (statusEl) {
                    statusEl.textContent = 'Not Connected';
                    statusEl.className = 'badge bg-secondary';
                }
                alert('Connection Timeout: No TV connection detected.');
                // Disconnect and clean up
                disconnectViewer(tvViewerNumber);
            }
        });
    }
    
    // Start checking connection
    checkConnection();
}

// Join existing connection on remote device
function joinConnection() {
    const code = prompt('Enter connection code to join:');
    if (!code) return;

    fetch('get-sync.php?connection_code=' + encodeURIComponent(code), {
        method: 'GET'
    })
    .then(async response => {
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            throw new Error(text || 'Server error');
        }

        if (data.success) {
            connectionCodes[data.data.tv_number] = code;
            isMainController = false;

            alert('Connected to TV' + data.data.tv_number + '! Starting sync...');
            displayRemoteContent(data.data);
            startSync(data.data.tv_number);
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Join error:', error);
        alert('Error joining connection: ' + error.message);
    });
}

// Start polling for sync updates
function startSync(tv) {
    // Avoid self-updates on the main controller to prevent flicker
    if (isMainController) return;
    // Clear existing interval
    if (syncInterval) clearInterval(syncInterval);

    // Poll every 500ms for updates (near real-time sync)
    syncInterval = setInterval(function() {
        const activeCode = connectionCodes[tv];
        if (!activeCode) return;

        fetch('get-sync.php?connection_code=' + encodeURIComponent(activeCode))
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    lastHeartbeat[tv] = Date.now();
                    if (!connectionStatus[tv]) {
                        updateConnectionStatus(tv, true);
                    }
                    displayRemoteContent(data.data);
                }
            })
            .catch(error => console.error('Sync error:', error));
    }, 500);
}

// Display content from remote TV
function displayRemoteContent(tvState) {
    // Skip overriding local playback when acting as main controller
    if (isMainController) return;
    const videoPlayerId = `videoPlayerTV${tvState.tv_number}`;
    const pictureViewerId = `pictureViewerTV${tvState.tv_number}`;
    const videoPlayer = document.getElementById(videoPlayerId);
    const pictureViewer = document.getElementById(pictureViewerId);

    if (tvState.current_video) {
        videoPlayer.src = 'uploads/' + tvState.current_video;
        if (tvState.video_timestamp > 0) {
            videoPlayer.currentTime = tvState.video_timestamp;
        }
        if (tvState.play_status === 'playing') {
            videoPlayer.play();
        } else if (tvState.play_status === 'paused') {
            videoPlayer.pause();
        }
        pictureViewer.style.display = 'none';
    } else if (tvState.current_picture) {
        pictureViewer.src = 'uploads/' + tvState.current_picture;
        pictureViewer.style.display = 'block';
        videoPlayer.style.display = 'none';
    }
}

// Handle video upload (supports multiple files)
function handleVideoUpload(folder) {
    const fileInput = document.getElementById('videoFile');
    const files = fileInput.files;
    const progressContainer = document.getElementById('videoProgressContainer');
    const progressBar = document.getElementById('videoProgressBar');
    const progressText = document.getElementById('videoProgressText');

    if (files.length === 0) {
        alert('Please select video file(s)');
        return;
    }

    let uploadedCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    let duplicateFiles = [];

    // Reset and show progress bar
    progressBar.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', 0);
    progressText.textContent = '0%';
    progressContainer.style.display = 'block';

    // Upload each file sequentially
    function uploadNextFile(index) {
        if (index >= files.length) {
            // All files processed - hide progress bar and refresh lists
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            progressText.textContent = '100%';
            setTimeout(() => { progressContainer.style.display = 'none'; }, 300);
            if (uploadedCount > 0) {
                updateContentList();
                fileInput.value = '';
            }
            return;
        }

        const file = files[index];
        
        // Check if file already exists BEFORE uploading (check by original filename)
        let isDuplicate = false;
        let existingFiles = [];
        
        if (folder === 'content') {
            existingFiles = window.tvContent.videos;
        } else {
            existingFiles = window.tvContent.slideshow.videos;
        }
        
        // Check if any existing file matches the original filename
        isDuplicate = existingFiles.some(v => {
            // Extract original filename from saved filename (remove timestamp if exists)
            const savedName = v.filename;
            // Check if saved name contains the original file name
            return savedName.includes(file.name.replace(/\.[^/.]+$/, ''));
        });
        
        if (isDuplicate) {
            console.log('File already exists, skipping upload:', file.name);
            duplicateCount++;
            duplicateFiles.push(file.name);
            uploadNextFile(index + 1);
            return;
        }

        // Show progress bar and update percentage
        const totalFiles = files.length;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'video');
        formData.append('folder', folder);

        // Create XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const currentFraction = e.total > 0 ? (e.loaded / e.total) : 0;
                const completed = index; // files already finished
                const overallPercent = Math.min(100, Math.round(((completed + currentFraction) / totalFiles) * 100));
                progressBar.style.width = overallPercent + '%';
                progressBar.setAttribute('aria-valuenow', overallPercent);
                progressText.textContent = overallPercent + '%';
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const data = JSON.parse(xhr.responseText);
                if (!data.success) {
                    // Check if it's a duplicate error from server
                    if (data.duplicate) {
                        console.log('Server detected duplicate:', file.name);
                        duplicateCount++;
                        duplicateFiles.push(file.name);
                    } else {
                        console.error('Upload error for ' + file.name + ':', data.message);
                        failedCount++;
                    }
                } else {
                    const savedFilename = data.filename;
                    
                    if (folder === 'content') {
                        window.tvContent.videos.unshift({ name: file.name, filename: savedFilename });
                        uploadedCount++;
                    } else {
                        window.tvContent.slideshow.videos.unshift({ name: file.name, filename: savedFilename });
                        window.slideshowOrder.unshift({ filename: savedFilename, type: 'video' });
                        localStorage.setItem('slideshowOrder', JSON.stringify(window.slideshowOrder));
                        saveSlideshowToServer();
                        uploadedCount++;
                    }
                }
                uploadNextFile(index + 1);
            } catch (e) {
                console.error('Parse error:', e);
                failedCount++;
                uploadNextFile(index + 1);
            }
        });

        xhr.addEventListener('error', () => {
            console.error('Upload error for ' + file.name);
            failedCount++;
            uploadNextFile(index + 1);
        });

        xhr.open('POST', 'upload.php');
        xhr.send(formData);
    }

    uploadNextFile(0);
}

// Handle picture upload (supports multiple files)
function handlePictureUpload(folder) {
    const fileInput = document.getElementById('pictureFile');
    const files = fileInput.files;
    const progressContainer = document.getElementById('pictureProgressContainer');
    const progressBar = document.getElementById('pictureProgressBar');
    const progressText = document.getElementById('pictureProgressText');

    if (files.length === 0) {
        alert('Please select picture file(s)');
        return;
    }

    let uploadedCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    let duplicateFiles = [];

    // Reset and show progress bar
    progressBar.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', 0);
    progressText.textContent = '0%';
    progressContainer.style.display = 'block';

    // Upload each file sequentially
    function uploadNextFile(index) {
        if (index >= files.length) {
            // All files processed - hide progress bar and refresh lists
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            progressText.textContent = '100%';
            setTimeout(() => { progressContainer.style.display = 'none'; }, 300);
            if (uploadedCount > 0) {
                updateContentList();
                fileInput.value = '';
            }
            return;
        }

        const file = files[index];
        
        // Check if file already exists BEFORE uploading (check by original filename)
        let isDuplicate = false;
        let existingFiles = [];
        
        if (folder === 'content') {
            existingFiles = window.tvContent.pictures;
        } else {
            existingFiles = window.tvContent.slideshow.pictures;
        }
        
        // Check if any existing file matches the original filename
        isDuplicate = existingFiles.some(p => {
            // Extract original filename from saved filename (remove timestamp if exists)
            const savedName = p.filename;
            // Check if saved name contains the original file name
            return savedName.includes(file.name.replace(/\.[^/.]+$/, ''));
        });
        
        if (isDuplicate) {
            console.log('File already exists, skipping upload:', file.name);
            duplicateCount++;
            duplicateFiles.push(file.name);
            uploadNextFile(index + 1);
            return;
        }
        
        const totalFiles = files.length;

        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'picture');
        formData.append('folder', folder);

        // Create XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const currentFraction = e.total > 0 ? (e.loaded / e.total) : 0;
                const completed = index; // files already finished
                const overallPercent = Math.min(100, Math.round(((completed + currentFraction) / totalFiles) * 100));
                progressBar.style.width = overallPercent + '%';
                progressBar.setAttribute('aria-valuenow', overallPercent);
                progressText.textContent = overallPercent + '%';
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const data = JSON.parse(xhr.responseText);
                if (!data.success) {
                    // Check if it's a duplicate error from server
                    if (data.duplicate) {
                        console.log('Server detected duplicate:', file.name);
                        duplicateCount++;
                        duplicateFiles.push(file.name);
                    } else {
                        console.error('Upload error for ' + file.name + ':', data.message);
                        failedCount++;
                    }
                } else {
                    const savedFilename = data.filename;
                    
                    if (folder === 'content') {
                        window.tvContent.pictures.unshift({ name: file.name, filename: savedFilename });
                        uploadedCount++;
                    } else {
                        window.tvContent.slideshow.pictures.unshift({ name: file.name, filename: savedFilename });
                        window.slideshowOrder.unshift({ filename: savedFilename, type: 'picture' });
                        localStorage.setItem('slideshowOrder', JSON.stringify(window.slideshowOrder));
                        saveSlideshowToServer();
                        uploadedCount++;
                    }
                }
                uploadNextFile(index + 1);
            } catch (e) {
                console.error('Parse error:', e);
                failedCount++;
                uploadNextFile(index + 1);
            }
        });

        xhr.addEventListener('error', () => {
            console.error('Upload error for ' + file.name);
            failedCount++;
            uploadNextFile(index + 1);
        });

        xhr.open('POST', 'upload.php');
        xhr.send(formData);
    }

    uploadNextFile(0);
}

// Update TV state in database
function updateTVState(tv, contentType, filename, folder = 'content', playStatus = null) {
    const connectionCode = connectionCodes[tv];
    if (!connectionCode) return;
    
    // Determine play status: default to 'paused' for videos, 'stopped' for pictures
    if (playStatus === null) {
        playStatus = contentType === 'video' ? 'paused' : 'stopped';
    }

    fetch('sync.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            connection_code: connectionCode,
            tv_number: tv,
            content_type: contentType,
            filename: filename,
            folder: folder,
            play_status: playStatus,
            video_timestamp: 0
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Sync error:', data.message);
            silentReconnect(tv);
        }
    })
    .catch(error => console.error('Sync error:', error));
}

// Sync play/pause state to database
function syncPlayState(tv, status) {
    const connectionCode = connectionCodes[tv];
    if (!connectionCode) return;
    const videoEl = document.getElementById(`videoPlayerTV${tv}`);
    const timestamp = (videoEl && Number.isFinite(videoEl.currentTime)) ? videoEl.currentTime : 0;
    
    fetch('sync.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            connection_code: connectionCode,
            tv_number: tv,
            play_status: status,
            video_timestamp: timestamp
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Play state sync error:', data.message);
        }
    })
    .catch(error => console.error('Play state sync error:', error));
}

// Sync volume to database
function syncVolumeState(tv, volume) {
    const connectionCode = connectionCodes[tv];
    if (!connectionCode) return;
    
    fetch('sync.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            connection_code: connectionCode,
            video_volume: volume
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Volume sync error:', data.message);
        }
    })
    .catch(error => console.error('Volume sync error:', error));
}

// Sync playback speed to database
function syncSpeedState(tv, speed) {
    const connectionCode = connectionCodes[tv];
    if (!connectionCode) return;
    
    fetch('sync.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            connection_code: connectionCode,
            playback_speed: speed
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Speed sync error:', data.message);
        }
    })
    .catch(error => console.error('Speed sync error:', error));
}

// Update content list display with TV1/TV2 buttons for each item
function updateContentList() {
    const contentList = document.getElementById('contentList');
    contentList.innerHTML = '';

    // Add controls for Current Content
    const contentControlsDiv = document.createElement('div');
    contentControlsDiv.className = 'mb-3 d-flex flex-wrap align-items-center gap-2';
    const playDropdown = renderBulkPlayDropdown('Play Selected');
    contentControlsDiv.innerHTML = `
        <button class="btn btn-sm btn-secondary" onclick="selectAllContentFiles()">Select All</button>
        <button class="btn btn-sm btn-success" onclick="addSelectedContentToSlideshow()">Add to Slideshow</button>
        ${playDropdown}
        <button class="btn btn-sm btn-danger" onclick="deleteSelectedContentFiles()">Delete Selected</button>
    `;
    contentList.appendChild(contentControlsDiv);

    // Display all videos with TV1/TV2/Both play buttons
    window.tvContent.videos.forEach(video => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex flex-wrap align-items-center gap-2';
        li.style.gap = '0.5rem';
        li.dataset.filename = video.filename.toLowerCase(); // Store for search filtering
        
        // Add checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'content-file-checkbox';
        checkbox.dataset.filename = video.filename;
        checkbox.dataset.type = 'video';
        li.appendChild(checkbox);
        
        const nameSpan = document.createElement('span');
        // Show full filename (including extension) in the list
        nameSpan.innerHTML = `<i class="bi bi-film"></i> ${video.filename}`;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.minWidth = '200px';
        nameSpan.style.wordBreak = 'break-word';
        nameSpan.style.flex = '1';
        nameSpan.ondblclick = function() {
            makeEditable(nameSpan, video, 'video', 'content');
        };
        li.appendChild(nameSpan);

        // Single-click anywhere on the row (except controls) toggles checkbox
        li.addEventListener('click', function(e) {
            if (e.target.closest('button, .dropdown-menu, .dropdown-item, input[type="checkbox"], a')) {
                return;
            }
            checkbox.checked = !checkbox.checked;
        });

        const btnDiv = document.createElement('div');
        btnDiv.className = 'btn-group flex-wrap';
        btnDiv.style.display = 'flex';
        btnDiv.style.gap = '0.25rem';
            btnDiv.innerHTML = '';
        li.appendChild(btnDiv);
        contentList.appendChild(li);
    });

    // Display all pictures with TV1/TV2/Both show buttons
    window.tvContent.pictures.forEach(picture => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex flex-wrap align-items-center gap-2';
        li.style.gap = '0.5rem';
        li.dataset.filename = picture.filename.toLowerCase(); // Store for search filtering
        
        // Add checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'content-file-checkbox';
        checkbox.dataset.filename = picture.filename;
        checkbox.dataset.type = 'picture';
        li.appendChild(checkbox);
        
        const nameSpan = document.createElement('span');
        // Show full filename (including extension) in the list
        nameSpan.innerHTML = `<i class="bi bi-image"></i> ${picture.filename}`;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.minWidth = '200px';
        nameSpan.style.wordBreak = 'break-word';
        nameSpan.style.flex = '1';
        nameSpan.ondblclick = function() {
            makeEditable(nameSpan, picture, 'picture', 'content');
        };
        li.appendChild(nameSpan);

        // Single-click anywhere on the row (except controls) toggles checkbox
        li.addEventListener('click', function(e) {
            if (e.target.closest('button, .dropdown-menu, .dropdown-item, input[type="checkbox"], a')) {
                return;
            }
            checkbox.checked = !checkbox.checked;
        });

        const btnDiv = document.createElement('div');
        btnDiv.className = 'btn-group flex-wrap';
        btnDiv.style.display = 'flex';
        btnDiv.style.gap = '0.25rem';
            btnDiv.innerHTML = '';
        li.appendChild(btnDiv);
        contentList.appendChild(li);
    });

    // Update Slideshow List
    const slideshowList = document.getElementById('slideshowList');
    slideshowList.innerHTML = '';

    // Add controls for Slideshow
    const slideshowControlsDiv = document.createElement('div');
    slideshowControlsDiv.className = 'mb-3';
    slideshowControlsDiv.innerHTML = `
        <button class="btn btn-sm btn-secondary me-2" onclick="selectAllSlideshowFiles()">Select All</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSelectedSlideshowFiles()">Delete Selected</button>
    `;
    slideshowList.appendChild(slideshowControlsDiv);

    // Build slideshow files using the global order
    const allSlideshowFiles = window.slideshowOrder.map(item => {
        if (item.type === 'video') {
            const video = window.tvContent.slideshow.videos.find(v => v.filename === item.filename);
            return video ? { ...video, type: 'video' } : null;
        } else {
            const picture = window.tvContent.slideshow.pictures.find(p => p.filename === item.filename);
            return picture ? { ...picture, type: 'picture' } : null;
        }
    }).filter(f => f !== null);

    // Global variable to track drag state
    let draggedFile = null;

    // Display all slideshow files in order (mixed videos and pictures)
    allSlideshowFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex flex-wrap align-items-center gap-2';
        li.style.gap = '0.5rem';
        li.draggable = true;
        li.dataset.filename = file.filename;
        li.dataset.filenameSearch = file.filename.toLowerCase(); // For search filtering
        li.dataset.fileType = file.type;
        li.style.cursor = 'grab';

        // Drag events
        li.addEventListener('dragstart', function(e) {
            draggedFile = { ...file };
            this.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });

        li.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedFile && draggedFile.filename !== file.filename) {
                this.style.borderTop = '2px solid #0d6efd';
            }
        });

        li.addEventListener('dragleave', function(e) {
            this.style.borderTop = '';
        });

        li.addEventListener('drop', function(e) {
            e.preventDefault();
            if (draggedFile && draggedFile.filename !== file.filename) {
                // Find current indices
                const draggedIndex = allSlideshowFiles.findIndex(f => f.filename === draggedFile.filename);
                const targetIndex = allSlideshowFiles.findIndex(f => f.filename === file.filename);
                
                if (draggedIndex !== -1 && targetIndex !== -1) {
                    // Reorder the combined array
                    const [removed] = allSlideshowFiles.splice(draggedIndex, 1);
                    allSlideshowFiles.splice(targetIndex, 0, removed);
                    
                    // Update global order
                    window.slideshowOrder = allSlideshowFiles.map(f => ({ filename: f.filename, type: f.type }));
                    
                    // Save order to localStorage
                    localStorage.setItem('slideshowOrder', JSON.stringify(window.slideshowOrder));
                    
                    // Update the separate arrays with the new order
                    window.tvContent.slideshow.videos = allSlideshowFiles.filter(f => f.type === 'video').map(f => ({ name: f.name, filename: f.filename }));
                    window.tvContent.slideshow.pictures = allSlideshowFiles.filter(f => f.type === 'picture').map(f => ({ name: f.name, filename: f.filename }));
                    
                    updateContentList();
                }
            }
        });

        li.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
            this.style.borderTop = '';
            draggedFile = null;
        });

        // Add checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'slideshow-file-checkbox';
        checkbox.dataset.filename = file.filename;
        checkbox.dataset.type = file.type;
        li.insertBefore(checkbox, li.firstChild);

        const nameSpan = document.createElement('span');
        const icon = file.type === 'video' ? 'film' : 'image';
        nameSpan.innerHTML = `<i class="bi bi-${icon}"></i> ${file.filename}`;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.minWidth = '200px';
        nameSpan.style.wordBreak = 'break-word';
        nameSpan.style.flex = '1';
        nameSpan.ondblclick = function() {
            makeEditable(nameSpan, file, file.type, 'slideshow');
        };
        li.appendChild(nameSpan);

        // Single-click anywhere on the row (except controls) toggles checkbox
        li.addEventListener('click', function(e) {
            if (e.target.closest('button, .dropdown-menu, .dropdown-item, input[type="checkbox"], a')) {
                return;
            }
            checkbox.checked = !checkbox.checked;
        });

        const btnDiv = document.createElement('div');
        btnDiv.className = 'btn-group flex-wrap';
        btnDiv.style.display = 'flex';
        btnDiv.style.gap = '0.25rem';
        btnDiv.innerHTML = `<button class="btn btn-sm btn-secondary" onclick="duplicateSlideshowFile('${file.filename}', '${file.type}')">Duplicate</button>` +
                    renderActionDropdown('Check', file.type, file.filename, 'slideshow');
        li.appendChild(btnDiv);
        slideshowList.appendChild(li);
    });
}

// Make filename editable on double-click
function makeEditable(span, item, type, folder) {
    // Derive base name without extension from actual filename
    const dotIndex = item.filename.lastIndexOf('.');
    const currentBaseName = dotIndex !== -1 ? item.filename.substring(0, dotIndex) : item.filename;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentBaseName;
    input.className = 'form-control';
    const widthChars = Math.max(30, Math.min(120, currentBaseName.length + 5)); // scale with name length
    input.style.width = `${widthChars}ch`;

    span.innerHTML = '';
    span.appendChild(input);
    input.focus();
    input.select();

    function finishEdit() {
        const newName = input.value.trim();
        if (newName && newName !== currentBaseName) {
            renameFile(item.filename, newName, type, folder, span, item);
        } else {
            // Cancel edit - restore original (show full filename)
            span.innerHTML = `<i class=\"bi bi-${type === 'video' ? 'film' : 'image'}\"></i> ${item.filename}`;
            span.style.cursor = 'pointer';
        }
    }

    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            finishEdit();
        }
    });

    input.addEventListener('blur', finishEdit);
}

// Rename file on server
function renameFile(oldFilename, newName, type, folder, span, item) {
    fetch('rename.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            oldFilename: oldFilename,
            newName: newName,
            type: type,
            folder: folder
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.message || 'Rename failed');
        }
        
        // Update the item in memory
        item.name = newName; // store base name without extension
        item.filename = data.newFilename; // full filename with extension

        // Update the UI (show full filename with extension)
        span.innerHTML = `<i class=\"bi bi-${type === 'video' ? 'film' : 'image'}\"></i> ${item.filename}`;
        span.style.cursor = 'pointer';

        // Re-render the list so action buttons use the new filename
        updateContentList();

    })
    .catch(error => {
        console.error('Rename error:', error);
        alert('Rename failed: ' + error.message);
        // Restore original full filename
        span.innerHTML = `<i class=\"bi bi-${type === 'video' ? 'film' : 'image'}\"></i> ${item.filename}`;
        span.style.cursor = 'pointer';
    });
}

// Delete content from server and UI
function deleteContent(filename, type, folder = 'content') {
    // For slideshow items, check if there are multiple references to the same file
    let shouldDeletePhysicalFile = true;
    if (folder === 'slideshow') {
        // Count how many times this file appears in slideshowOrder
        const fileCount = window.slideshowOrder.filter(item => item.filename === filename).length;
        
        if (fileCount > 1) {
            // Multiple references exist, don't delete the physical file
            shouldDeletePhysicalFile = false;
            
            // Just remove one entry from slideshowOrder
            const indexToRemove = window.slideshowOrder.findIndex(item => item.filename === filename && item.type === type);
            if (indexToRemove !== -1) {
                window.slideshowOrder.splice(indexToRemove, 1);
            }
            
            // Save to localStorage
            localStorage.setItem('slideshowOrder', JSON.stringify(window.slideshowOrder));
            
            // Save to server
            saveSlideshowToServer();
            
            // Update UI
            updateContentList();
            return;
        }
    }

    // Delete the physical file if it's the last reference
    fetch('delete.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename, folder })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.message || 'Delete failed');
        }

        // Remove from the appropriate list based on folder
        if (folder === 'content') {
            window.tvContent[type + 's'] = window.tvContent[type + 's'].filter(item => item.filename !== filename);
        } else {
            window.tvContent.slideshow[type + 's'] = window.tvContent.slideshow[type + 's'].filter(item => item.filename !== filename);
            // Also remove from slideshowOrder (last reference)
            window.slideshowOrder = window.slideshowOrder.filter(item => item.filename !== filename);
            localStorage.setItem('slideshowOrder', JSON.stringify(window.slideshowOrder));
            saveSlideshowToServer();
        }

        updateContentList();

        // If this file is currently playing on any TV session, clear it from database
        clearDeletedContentFromSessions(filename, type, folder);
    })
    .catch(error => {
        console.error('Delete error:', error);
        alert('Delete failed: ' + error.message);
    });
}

// Duplicate a slideshow entry (adds another reference to the same file, doesn't create new file)
function duplicateSlideshowFile(filename, type) {
    // Find the index of the file being duplicated
    const originalIndex = window.slideshowOrder.findIndex(item => 
        item.filename === filename && item.type === type
    );
    
    // Insert the duplicate right after the original file
    if (originalIndex !== -1) {
        window.slideshowOrder.splice(originalIndex + 1, 0, {
            filename: filename,
            type: type
        });
    } else {
        // Fallback: add to end if original not found
        window.slideshowOrder.push({
            filename: filename,
            type: type
        });
    }

    // Save to localStorage
    localStorage.setItem('slideshowOrder', JSON.stringify(window.slideshowOrder));

    // Save to server
    saveSlideshowToServer();

    // Update UI
    updateContentList();
}

// Add file to slideshow
function addToSlideshow(filename, type, folder = 'content') {
    // Find the file in content
    const sourceList = window.tvContent[type + 's'];
    const file = sourceList.find(item => item.filename === filename);
    
    if (!file) {
        alert('File not found in content!');
        return;
    }

    // Copy file to slideshow folder on server
    fetch('copy-to-slideshow.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filename: filename,
            type: type,
            sourceFolder: folder
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            if (data.alreadyExists) {
                alert('A file already existed in the Slideshow!');
            } else {
                alert('Error: ' + data.message);
            }
            return;
        }

        // Add to slideshow at the beginning (top)
        window.tvContent.slideshow[type + 's'].unshift({
            name: file.name,
            filename: file.filename
        });

        // Update global slideshow order - add to beginning
        window.slideshowOrder.unshift({
            filename: filename,
            type: type
        });

        // Save to localStorage
        localStorage.setItem('slideshowOrder', JSON.stringify(window.slideshowOrder));

        // Save to server
        saveSlideshowToServer();

        // Update UI
        updateContentList();
    })
    .catch(error => {
        console.error('Add to slideshow error:', error);
        alert('Error adding to slideshow: ' + error.message);
    });
}

// Clear deleted file from all active TV sessions
function clearDeletedContentFromSessions(filename, type, folder = 'content') {
    // Use sync.php to clear the deleted content from all sessions
    // We need to update all tv_sessions entries that reference this deleted file
    const contentField = type === 'video' ? 'current_video' : 'current_picture';
    
    // Fetch the current session and clear if it matches the deleted file
    fetch('delete-from-sessions.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filename: filename,
            content_type: type,
            folder: folder
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Failed to clear from sessions:', data.message);
        }
    })
    .catch(error => console.error('Clear from sessions error:', error));
}

// Play content on specified TV
function playContent(tv, type, filename, folder = 'content') {
    const videoPlayerId = `videoPlayerTV${tv}`;
    const pictureViewerId = `pictureViewerTV${tv}`;
    const videoPlayer = document.getElementById(videoPlayerId);
    const pictureViewer = document.getElementById(pictureViewerId);

    // Check if there's already active content and confirm replacement
    if (hasActiveContent(tv)) {
        const contentTypeName = type === 'video' ? 'video' : type === 'picture' ? 'image' : 'content';
        if (!confirm(`TV${tv} is currently playing content. Do you want to replace it with the selected ${contentTypeName}?`)) {
            return; // User cancelled
        }
        // Clear slideshow state if replacing with single content
        if (slideshowState[tv]) {
            slideshowState[tv].files = [];
            slideshowState[tv].currentIndex = 0;
        }
    }

    // Handle 'current' type - play the last video or picture from current content
    if (type === 'current') {
        // Determine if we should play video or picture (prefer video if available)
        if (window.tvContent.videos.length > 0) {
            type = 'video';
            filename = window.tvContent.videos[window.tvContent.videos.length - 1].filename;
        } else if (window.tvContent.pictures.length > 0) {
            type = 'picture';
            filename = window.tvContent.pictures[window.tvContent.pictures.length - 1].filename;
        } else {
            alert('No files in Current Content');
            return;
        }
        folder = 'content';
    }

    if (type === 'video') {
        // Pause before switching source to avoid rapid reload flicker
        try { videoPlayer.pause(); } catch (e) {}
        const newSrc = 'uploads/' + folder + '/' + filename;
        videoPlayer.src = newSrc;
        videoPlayer.loop = false; // Disable auto-loop
        
        // Ensure video starts in paused state
        videoPlayer.onloadedmetadata = function() {
            // Video loaded, keep in paused state
            videoPlayer.pause();
        };
        
        // Also ensure paused state after load starts
        videoPlayer.onloadstart = function() {
            videoPlayer.pause();
        };
        
        pictureViewer.style.display = 'none';
        videoPlayer.style.display = 'block';
        
        // Force pause immediately
        setTimeout(() => {
            try { videoPlayer.pause(); } catch (e) {}
        }, 100);

        // If connected, sync to viewer; otherwise remember preview selection
        if (connectionCodes[tv]) {
            pendingPreview[tv] = null;
            updateTVState(tv, 'video', filename, folder, 'paused');
        } else {
            pendingPreview[tv] = { type: 'video', filename, folder };
        }
    } else if (type === 'picture') {
        // Ensure video is stopped when showing a picture
        try { videoPlayer.pause(); } catch (e) {}
        pictureViewer.src = 'uploads/' + folder + '/' + filename;
        pictureViewer.style.display = 'block';
        videoPlayer.style.display = 'none';

        if (connectionCodes[tv]) {
            pendingPreview[tv] = null;
            updateTVState(tv, 'picture', filename, folder);
        } else {
            pendingPreview[tv] = { type: 'picture', filename, folder };
        }
    }
}

// Play content on both TV1 and TV2 simultaneously
function playContentBoth(type, filename, folder = 'content') {
    playContent(1, type, filename, folder);
    playContent(2, type, filename, folder);
}

// Global slideshow state - track per TV
const slideshowState = {};

// Check if TV has active content (video playing or image displayed)
function hasActiveContent(tv) {
    const videoPlayer = document.getElementById(`videoPlayerTV${tv}`);
    const pictureViewer = document.getElementById(`pictureViewerTV${tv}`);
    
    // Check if video is loaded and has source
    if (videoPlayer && videoPlayer.src && videoPlayer.src.trim() && videoPlayer.src !== window.location.href && videoPlayer.style.display !== 'none') {
        return true;
    }
    
    // Check if picture is displayed and has source
    if (pictureViewer && pictureViewer.src && pictureViewer.src.trim() && pictureViewer.style.display !== 'none') {
        return true;
    }
    
    // Check if slideshow is loaded
    if (slideshowState[tv] && slideshowState[tv].files && slideshowState[tv].files.length > 0) {
        return true;
    }
    
    return false;
}

// Update play/pause button styles
function setPlayPauseUI(tvNum, isPlaying) {
    const playBtn = document.getElementById(`playBtnTV${tvNum}`);
    const pauseBtn = document.getElementById(`pauseBtnTV${tvNum}`);
    if (playBtn) {
        playBtn.classList.remove('btn-success', 'btn-secondary');
        playBtn.classList.add(isPlaying ? 'btn-success' : 'btn-secondary');
    }
    if (pauseBtn) {
        pauseBtn.classList.remove('btn-warning', 'btn-secondary');
        pauseBtn.classList.add(isPlaying ? 'btn-secondary' : 'btn-warning');
    }
}

// Initialize slideshow state for a TV
function initSlideshowState(tvNum) {
    if (!slideshowState[tvNum]) {
        slideshowState[tvNum] = {
            currentIndex: 0,
            isPlaying: false,
            isLooping: false,
            files: []
        };
    }
}

// Start slideshow playback
function startSlideshow() {
    const tvTarget = document.getElementById('tvTargetSelector').value;
    
    // Check if any target TV has active content
    const targetTVs = tvTarget === 'both' ? activeTVs : [parseInt(tvTarget)];
    const hasActive = targetTVs.some(tvNum => hasActiveContent(tvNum));
    
    if (hasActive) {
        const tvNames = targetTVs.filter(tvNum => hasActiveContent(tvNum)).map(tvNum => `TV${tvNum}`).join(', ');
        if (!confirm(`${tvNames} is currently playing content. Do you want to replace it with the slideshow?`)) {
            return; // User cancelled
        }
    }
    
    // Get all slideshow files in the order they're arranged (from global slideshowOrder)
    const allFiles = window.slideshowOrder.map(item => {
        if (item.type === 'video') {
            const video = window.tvContent.slideshow.videos.find(v => v.filename === item.filename);
            return video ? { ...video, type: 'video' } : null;
        } else {
            const picture = window.tvContent.slideshow.pictures.find(p => p.filename === item.filename);
            return picture ? { ...picture, type: 'picture' } : null;
        }
    }).filter(f => f !== null);

    if (allFiles.length === 0) {
        alert('No files in slideshow');
        return;
    }

    // Set up slideshow state for each target TV
    targetTVs.forEach(tvNum => {
        initSlideshowState(tvNum);
        slideshowState[tvNum].currentIndex = 0;
        slideshowState[tvNum].files = allFiles;
        slideshowState[tvNum].isPlaying = false; // Start paused
        slideshowState[tvNum].isLooping = false;
        
        // Load first file in paused state
        playCurrentSlideshowItem(tvNum);
        
        // Update loop button appearance
        const loopBtn = document.getElementById(`loopBtnTV${tvNum}`);
        if (loopBtn) {
            loopBtn.classList.remove('btn-success');
            loopBtn.classList.add('btn-secondary');
        }
    });
    
    alert('Slideshow loaded. Use Play button to start.');
}

// Copy connection code to clipboard
function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(function() {
        alert('Connection code copied!');
    });
}

// Clear content from specified TV
function clearContent(tv) {
    const videoPlayerId = `videoPlayerTV${tv}`;
    const pictureViewerId = `pictureViewerTV${tv}`;
    const videoPlayer = document.getElementById(videoPlayerId);
    const pictureViewer = document.getElementById(pictureViewerId);

    // Clear video and picture completely
    if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.src = '';
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
        videoPlayer.style.display = 'none';
    }
    
    if (pictureViewer) {
        pictureViewer.src = '';
        pictureViewer.removeAttribute('src');
        pictureViewer.style.display = 'none';
    }

    // Clear pending preview state
    pendingPreview[tv] = null;

    // Clear slideshow state for this TV
    if (slideshowState[tv]) {
        slideshowState[tv].files = [];
        slideshowState[tv].currentIndex = 0;
    }

    // Sync cleared state to database so viewers see the change
    const connectionCode = connectionCodes[tv];
    if (connectionCode) {
        fetch('sync.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                connection_code: connectionCode,
                clear_all: true  // Signal to clear all content
            })
        })
        .then(response => response.json())
        .catch(error => console.error('Clear sync error:', error));
    }
}

function connectTVs() {
    joinConnection();
}

// Disconnect a TV viewer and clear state
function disconnectViewer(tv) {
    const code = connectionCodes[tv];
    if (!code) {
        updateConnectionStatus(tv, false);
        return;
    }

    fetch('disconnect.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_code: code })
    })
    .catch(() => {})
    .finally(() => {
        connectionCodes[tv] = null;
        localStorage.removeItem(`connectionCodeTV${tv}`);
        updateConnectionStatus(tv, false);
        lastHeartbeat[tv] = null;

        // Stop heartbeat polling for this TV if running
        const pollKey = `heartbeatPoll_${tv}`;
        if (window[pollKey]) {
            clearInterval(window[pollKey]);
            window[pollKey] = null;
        }

        // Clear player UI
        const videoPlayer = document.getElementById(`videoPlayerTV${tv}`);
        const pictureViewer = document.getElementById(`pictureViewerTV${tv}`);
        if (videoPlayer) {
            try { videoPlayer.pause(); } catch (e) {}
            videoPlayer.src = '';
            videoPlayer.style.display = 'block';
        }
        if (pictureViewer) {
            pictureViewer.src = '';
            pictureViewer.style.display = 'none';
        }
    });
}

// ===== DYNAMIC TV MANAGEMENT =====

function renderTVCards() {
    const container = document.getElementById('tvPlayersContainer');
    container.innerHTML = '';

    activeTVs.forEach(tvNum => {
        const cardHtml = `
            <div class="col-12 col-md-6" id="tvCard_${tvNum}">
                <div class="card shadow tv-card" style="min-height: 500px; display: flex; flex-direction: column;">
                    <div class="card-header tv-card-header d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                            <h3 class="card-title mb-0">TV ${tvNum}</h3>
                            <button class="btn btn-sm btn-danger" onclick="removeTV(${tvNum})" style="padding: 2px 8px; font-size: 18px; line-height: 1;">−</button>
                        </div>
                        <span id="statusTV${tvNum}" class="badge bg-secondary">Not Connected</span>
                    </div>
                    <div class="card-body tv-card-body" style="flex: 1; display: flex; flex-direction: column; padding: 1rem; gap: 0;">
                        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                            <video id="videoPlayerTV${tvNum}" controls loop class="w-100" style="flex: 1; object-fit: contain; display: block;"></video>
                            <img id="pictureViewerTV${tvNum}" class="w-100" style="display: none; flex: 1; object-fit: contain;">
                            
                            <div id="connectionCodeTV${tvNum}" class="alert alert-info mb-0" style="display: none; margin-top: 0.5rem;">
                                <strong>Connection Code:</strong> <span id="codeTV${tvNum}"></span>
                                <button type="button" class="btn btn-sm btn-outline-info ms-2" onclick="copyToClipboard('codeTV${tvNum}')">Copy</button>
                            </div>
                        </div>
                        
                        <div class="d-flex justify-content-between gap-2" style="margin-top: 1rem;">
                            <div class="d-flex align-items-center">
                                <button id="connectBtnTV${tvNum}" class="btn btn-primary" onclick="connectToViewer(${tvNum})">Connect to TV Viewer</button>
                                <button id="disconnectBtnTV${tvNum}" class="btn btn-outline-danger ms-2" onclick="disconnectViewer(${tvNum})" style="display: none;">Disconnect</button>
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-danger" onclick="clearContent(${tvNum})">Remove Content</button>
                            </div>
                        </div>
                        
                        <!-- Playback Controls -->
                        <div class="d-flex flex-wrap gap-2 justify-content-center" style="margin-top: 1rem;">
                            <button class="btn btn-sm btn-secondary" id="playBtnTV${tvNum}" onclick="playTV(${tvNum})" title="Play"><i class="bi bi-play-fill"></i> Play</button>
                            <button class="btn btn-sm btn-secondary" id="pauseBtnTV${tvNum}" onclick="pauseTV(${tvNum})" title="Pause"><i class="bi bi-pause-fill"></i> Pause</button>
                            <button class="btn btn-sm btn-secondary" id="loopBtnTV${tvNum}" onclick="toggleLoopTV(${tvNum})" title="Toggle Loop"><i class="bi bi-arrow-repeat"></i> Loop</button>
                            <button class="btn btn-sm btn-primary" onclick="previousTV(${tvNum})" title="Previous"><i class="bi bi-skip-start-fill"></i> Previous</button>
                            <button class="btn btn-sm btn-primary" onclick="nextTV(${tvNum})" title="Next"><i class="bi bi-skip-end-fill"></i> Next</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);

        // Add event listeners for video players
        const videoPlayer = document.getElementById(`videoPlayerTV${tvNum}`);
        if (videoPlayer) {
            // Remove loop attribute - manual control only
            videoPlayer.loop = false;
            
            videoPlayer.addEventListener('play', function() {
                if (connectionCodes[tvNum]) {
                    syncPlayState(tvNum, 'playing');
                }
                setPlayPauseUI(tvNum, true);
            });
            videoPlayer.addEventListener('pause', function() {
                if (connectionCodes[tvNum]) {
                    syncPlayState(tvNum, 'paused');
                }
                setPlayPauseUI(tvNum, false);
            });
            
            // Track if seeking is user-initiated to avoid syncing during normal playback
            let userSeeking = false;
            videoPlayer.addEventListener('seeking', function() {
                userSeeking = true;
            });
            videoPlayer.addEventListener('seeked', function() {
                if (connectionCodes[tvNum] && userSeeking) {
                    syncPlayState(tvNum, videoPlayer.paused ? 'paused' : 'playing');
                    userSeeking = false;
                }
            });
            videoPlayer.addEventListener('volumechange', function() {
                if (connectionCodes[tvNum]) {
                    syncVolumeState(tvNum, videoPlayer.volume);
                }
            });
            videoPlayer.addEventListener('ratechange', function() {
                if (connectionCodes[tvNum]) {
                    syncSpeedState(tvNum, videoPlayer.playbackRate);
                }
            });
        }
    });

    // Update dropdown options
    updateTVSelectorDropdown();
}

function addNewTV() {
    // Find next available TV number
    let nextTVNum = 1;
    while (activeTVs.includes(nextTVNum)) {
        nextTVNum++;
    }

    activeTVs.push(nextTVNum);
    connectionCodes[nextTVNum] = null;
    connectionStatus[nextTVNum] = false;
    lastHeartbeat[nextTVNum] = null;
    pendingPreview[nextTVNum] = null;

    // Save to localStorage
    localStorage.setItem('activeTVs', JSON.stringify(activeTVs));

    // Save to server
    saveActiveTVsToServer();

    // Render new TV card and refresh content lists
    renderTVCards();
    updateContentList();
}

function removeTV(tvNum) {
    // Block removal if TV is currently connected/being used
    if (connectionStatus[tvNum] || connectionCodes[tvNum]) {
        alert(`TV ${tvNum} is currently being used. Disconnect it first before removing.`);
        return;
    }

    if (!confirm(`Are you sure you want to remove TV ${tvNum}?`)) {
        return;
    }

    // Disconnect if connected
    disconnectViewer(tvNum);

    // Remove from active TVs
    activeTVs = activeTVs.filter(n => n !== tvNum);

    // Clean up localStorage
    localStorage.removeItem(`connectionCodeTV${tvNum}`);
    localStorage.setItem('activeTVs', JSON.stringify(activeTVs));

    // Save to server
    saveActiveTVsToServer();

    // Clean up connection data
    delete connectionCodes[tvNum];
    delete connectionStatus[tvNum];
    delete lastHeartbeat[tvNum];
    delete pendingPreview[tvNum];

    // Remove only this TV card to avoid disrupting other players
    const card = document.getElementById(`tvCard_${tvNum}`);
    if (card && card.parentNode) {
        card.parentNode.removeChild(card);
    }

    // Update selectors without re-rendering all cards
    updateTVSelectorDropdown();
    updateContentList();
}

function updateTVSelectorDropdown() {
    const selector = document.getElementById('tvTargetSelector');
    const currentValue = selector.value;
    
    selector.innerHTML = '';
    
    activeTVs.forEach(tvNum => {
        const option = document.createElement('option');
        option.value = tvNum;
        option.text = `TV ${tvNum}`;
        selector.appendChild(option);
    });
    
    // Add "All TVs" option
    const allOption = document.createElement('option');
    allOption.value = 'both';
    allOption.text = 'All TVs';
    selector.appendChild(allOption);
    
    // Restore previous selection or default to first TV
    if (currentValue && selector.querySelector(`option[value="${currentValue}"]`)) {
        selector.value = currentValue;
    } else {
        selector.value = activeTVs[0] || '1';
    }
}

function saveActiveTVsToServer() {
    fetch('set-active-tvs.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tvs: activeTVs })
    })
    .then(response => response.json())
    .catch(err => console.warn('Failed to save TV list to server:', err));
}

// Save slideshow content to server
function saveSlideshowToServer() {
    fetch('save-slideshow.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slideshow: window.tvContent.slideshow,
            slideshowOrder: window.slideshowOrder
        })
    })
    .then(response => response.json())
    .catch(err => console.warn('Failed to save slideshow to server:', err));
}

// Build a generic action dropdown listing active TVs and All TVs
function renderActionDropdown(label, type, filename, folder) {
    const items = (activeTVs || []).map(tv =>
        `<li><a class="dropdown-item" href="#" onclick="playContent(${tv}, '${type}', '${filename}', '${folder}')">TV ${tv}</a></li>`
    ).join('');
    const allItem = `<li><a class="dropdown-item" href="#" onclick="playContentBoth('${type}', '${filename}', '${folder}')">All TVs</a></li>`;
    return `
        <div class="btn-group">
            <button class="btn btn-sm btn-success dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">${label}</button>
            <ul class="dropdown-menu">${items}${items ? '<li><hr class=\"dropdown-divider\"></li>' : ''}${allItem}</ul>
        </div>`;
}

// Build Play Selected dropdown for bulk actions
function renderBulkPlayDropdown(label) {
    const items = (activeTVs || []).map(tv =>
        `<li><a class="dropdown-item" href="#" onclick="playSelectedContentTarget(${tv})">TV ${tv}</a></li>`
    ).join('');
    const allItem = `<li><a class="dropdown-item" href="#" onclick="playSelectedContentTarget('both')">All TVs</a></li>`;
    return `
        <div class="btn-group">
            <button class="btn btn-sm btn-success dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">${label}</button>
            <ul class="dropdown-menu">${items}${items ? '<li><hr class=\"dropdown-divider\"></li>' : ''}${allItem}</ul>
        </div>`;
}

// Filter Current Content list based on search input
function filterContentList() {
    const searchBar = document.getElementById('contentSearchBar');
    if (!searchBar) {
        console.warn('Search bar not found');
        return;
    }
    
    const searchTerm = searchBar.value.toLowerCase().trim();
    const contentList = document.getElementById('contentList');
    const items = contentList.getElementsByTagName('li');
    
    // Automatically expand the "Show Files" dropdown if user is searching
    if (searchTerm !== '') {
        const collapseElement = document.getElementById('contentListCollapse');
        if (collapseElement && !collapseElement.classList.contains('show')) {
            const bsCollapse = new bootstrap.Collapse(collapseElement, {
                toggle: true
            });
        }
    }
    
    let hiddenCount = 0;
    let shownCount = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const filename = item.dataset.filename;
        const displayName = item.querySelector('span')?.textContent || 'unknown';
        
        console.log(`\n--- Item ${i} ---`);
        console.log('Display name:', displayName);
        console.log('data-filename:', filename);
        console.log('Search term:', searchTerm);
        
        if (!filename) {
            console.warn('Item', i, 'has no filename data');
            item.style.display = '';
            shownCount++;
            continue;
        }
        
        // Show all if search is empty
        if (searchTerm === '') {
            item.style.removeProperty('display');
            item.style.backgroundColor = '';
            shownCount++;
        } else {
            // Check if filename contains search term
            const matches = filename.includes(searchTerm);
            console.log('Match result:', matches);
            
            if (matches) {
                item.style.removeProperty('display');
                item.style.backgroundColor = '';
                shownCount++;
                console.log('✓ SHOWING this item');
            } else {
                item.style.setProperty('display', 'none', 'important');
                hiddenCount++;
                console.log('✗ HIDING this item');
            }
        }
    }
    
    console.log('Results: Shown=' + shownCount + ', Hidden=' + hiddenCount);
}
// Filter slideshow list based on search term
function filterSlideshowList() {
    const searchBar = document.getElementById('slideshowSearchBar');
    if (!searchBar) {
        console.warn('Slideshow search bar not found');
        return;
    }
    
    const searchTerm = searchBar.value.toLowerCase().trim();
    const slideshowList = document.getElementById('slideshowList');
    const items = slideshowList.getElementsByTagName('li');
    
    // Automatically expand the "Show Files" dropdown if user is searching
    if (searchTerm !== '') {
        const collapseElement = document.getElementById('slideshowListCollapse');
        if (collapseElement && !collapseElement.classList.contains('show')) {
            const bsCollapse = new bootstrap.Collapse(collapseElement, {
                toggle: true
            });
        }
    }
    
    console.log('Filtering slideshow with search term:', searchTerm);
    console.log('Total slideshow items:', items.length);

    let hiddenCount = 0;
    let shownCount = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const filename = item.dataset.filenameSearch;
        const displayName = item.querySelector('span')?.textContent || 'unknown';
        
        console.log(`\n--- Slideshow Item ${i} ---`);
        console.log('Display name:', displayName);
        console.log('data-filenameSearch:', filename);
        console.log('Search term:', searchTerm);
        
        if (!filename) {
            console.warn('Item', i, 'has no filename data');
            item.style.removeProperty('display');
            shownCount++;
            continue;
        }
        
        // Show all if search is empty
        if (searchTerm === '') {
            item.style.removeProperty('display');
            item.style.backgroundColor = '';
            shownCount++;
        } else {
            // Check if filename contains search term
            const matches = filename.includes(searchTerm);
            console.log('Match result:', matches);
            
            if (matches) {
                item.style.removeProperty('display');
                item.style.backgroundColor = '';
                shownCount++;
                console.log('✓ SHOWING this item');
            } else {
                item.style.setProperty('display', 'none', 'important');
                hiddenCount++;
                console.log('✗ HIDING this item');
            }
        }
    }
    
    console.log('Slideshow Results: Shown=' + shownCount + ', Hidden=' + hiddenCount);
}

// Add event listener to automatically show all files when search is cleared
document.addEventListener('DOMContentLoaded', function() {
    const searchBar = document.getElementById('contentSearchBar');
    if (searchBar) {
        searchBar.addEventListener('input', function() {
            // If search bar is empty, automatically show all files
            if (this.value.trim() === '') {
                filterContentList();
            }
        });
    }
    
    const slideshowSearchBar = document.getElementById('slideshowSearchBar');
    if (slideshowSearchBar) {
        slideshowSearchBar.addEventListener('input', function() {
            // If search bar is empty, automatically show all files
            if (this.value.trim() === '') {
                filterSlideshowList();
            }
        });
    }
});

// ===== PLAYBACK CONTROL FUNCTIONS =====

function playTV(tvNum) {
    initSlideshowState(tvNum);
    const videoPlayer = document.getElementById(`videoPlayerTV${tvNum}`);
    
    // If slideshow is loaded, resume slideshow
    if (slideshowState[tvNum].files.length > 0) {
        slideshowState[tvNum].isPlaying = true;
        playCurrentSlideshowItem(tvNum);
    } else if (videoPlayer && videoPlayer.src) {
        // Play current video
        videoPlayer.play();
        syncPlayState(tvNum, 'playing');
    }
    setPlayPauseUI(tvNum, true);
}

function pauseTV(tvNum) {
    initSlideshowState(tvNum);
    const videoPlayer = document.getElementById(`videoPlayerTV${tvNum}`);
    
    // Pause slideshow or video
    slideshowState[tvNum].isPlaying = false;
    if (videoPlayer) {
        videoPlayer.pause();
        syncPlayState(tvNum, 'paused');
    }
    setPlayPauseUI(tvNum, false);
}

function toggleLoopTV(tvNum) {
    initSlideshowState(tvNum);
    const loopBtn = document.getElementById(`loopBtnTV${tvNum}`);
    
    slideshowState[tvNum].isLooping = !slideshowState[tvNum].isLooping;
    
    // Update button appearance
    if (slideshowState[tvNum].isLooping) {
        loopBtn.classList.remove('btn-secondary');
        loopBtn.classList.add('btn-success');
    } else {
        loopBtn.classList.remove('btn-success');
        loopBtn.classList.add('btn-secondary');
    }
    
    // Update video loop attribute
    const videoPlayer = document.getElementById(`videoPlayerTV${tvNum}`);
    if (videoPlayer) {
        videoPlayer.loop = slideshowState[tvNum].isLooping;
    }
}

function previousTV(tvNum) {
    initSlideshowState(tvNum);
    
    // Only works in slideshow mode when not looping
    if (slideshowState[tvNum].files.length === 0) return;
    if (slideshowState[tvNum].isLooping) return;
    
    slideshowState[tvNum].currentIndex--;
    if (slideshowState[tvNum].currentIndex < 0) {
        slideshowState[tvNum].currentIndex = slideshowState[tvNum].files.length - 1;
    }
    
    playCurrentSlideshowItem(tvNum);
}

function nextTV(tvNum) {
    initSlideshowState(tvNum);
    
    // Only works in slideshow mode when not looping
    if (slideshowState[tvNum].files.length === 0) return;
    if (slideshowState[tvNum].isLooping) return;
    
    slideshowState[tvNum].currentIndex++;
    if (slideshowState[tvNum].currentIndex >= slideshowState[tvNum].files.length) {
        slideshowState[tvNum].currentIndex = 0;
    }
    
    playCurrentSlideshowItem(tvNum);
}

function playCurrentSlideshowItem(tvNum) {
    const state = slideshowState[tvNum];
    if (!state || state.files.length === 0) return;
    
    const currentFile = state.files[state.currentIndex];
    const videoPlayer = document.getElementById(`videoPlayerTV${tvNum}`);
    const pictureViewer = document.getElementById(`pictureViewerTV${tvNum}`);
    
    const folder = currentFile.folder || 'slideshow';

    if (currentFile.type === 'video') {
        videoPlayer.loop = false; // Controlled manually
        videoPlayer.src = 'uploads/' + folder + '/' + currentFile.filename;
        pictureViewer.style.display = 'none';
        videoPlayer.style.display = 'block';
        
        // Remove old onended handler and set new one
        videoPlayer.onended = null;
        if (state.isPlaying && !state.isLooping) {
            videoPlayer.onended = function() {
                if (state.isPlaying) {
                    state.currentIndex++;
                    if (state.currentIndex >= state.files.length) {
                        state.currentIndex = 0;
                        state.isPlaying = false; // Stop at end
                    } else {
                        playCurrentSlideshowItem(tvNum);
                    }
                }
            };
        }
        
        videoPlayer.currentTime = 0;
        if (state.isPlaying) {
            videoPlayer.play().catch(e => console.error('Play error:', e));
        } else {
            videoPlayer.pause();
        }
        
        // Sync to TV viewer with correct play status
        const playStatus = state.isPlaying ? 'playing' : 'paused';
        updateTVState(tvNum, 'video', currentFile.filename, folder, playStatus);
    } else {
        // Picture
        videoPlayer.pause();
        videoPlayer.style.display = 'none';
        pictureViewer.src = 'uploads/' + folder + '/' + currentFile.filename;
        pictureViewer.style.display = 'block';
        
        // Sync to TV viewer
        updateTVState(tvNum, 'picture', currentFile.filename, folder);
        
        // Auto-advance after delay if playing and not looping
        if (state.isPlaying && !state.isLooping) {
            const delayInput = document.getElementById('pictureDelay');
            const delaySeconds = parseInt(delayInput.value) || 5;
            const delayMs = delaySeconds * 1000;
            setTimeout(() => {
                if (state.isPlaying) {
                    state.currentIndex++;
                    if (state.currentIndex >= state.files.length) {
                        state.currentIndex = 0;
                        state.isPlaying = false; // Stop at end
                    } else {
                        playCurrentSlideshowItem(tvNum);
                    }
                }
            }, delayMs);
        }
    }
}

// Select all checkboxes in Current Content
// Toggle all checkboxes in Current Content
function selectAllContentFiles() {
    const checkboxes = document.querySelectorAll('.content-file-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

// Toggle all checkboxes in Slideshow
function selectAllSlideshowFiles() {
    const checkboxes = document.querySelectorAll('.slideshow-file-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

// Delete selected files from Current Content
function deleteSelectedContentFiles() {
    const checkboxes = document.querySelectorAll('.content-file-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Please select files to delete');
        return;
    }
    
    if (!confirm(`Delete ${checkboxes.length} file(s) from Current Content?`)) {
        return;
    }
    
    checkboxes.forEach(cb => {
        deleteContent(cb.dataset.filename, cb.dataset.type, 'content');
    });
}

// Add selected files from Current Content to Slideshow
function addSelectedContentToSlideshow() {
    const checkboxes = document.querySelectorAll('.content-file-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Please select files to add to slideshow');
        return;
    }
    
    checkboxes.forEach(cb => {
        addToSlideshow(cb.dataset.filename, cb.dataset.type, 'content');
    });
}

// Play selected files from Current Content (in list order) on chosen TV(s)
function playSelectedContentTarget(target) {
    const contentList = document.getElementById('contentList');
    if (!contentList) return;

    const orderedCheckboxes = contentList.querySelectorAll('li input.content-file-checkbox');
    const selectedFiles = [];
    orderedCheckboxes.forEach(cb => {
        if (cb.checked) {
            selectedFiles.push({ filename: cb.dataset.filename, type: cb.dataset.type, folder: 'content' });
        }
    });

    if (selectedFiles.length === 0) {
        alert('Please select files to play');
        return;
    }

    const targetTVs = target === 'both' ? (activeTVs || []) : [parseInt(target, 10)];
    if (!targetTVs || targetTVs.length === 0 || targetTVs.some(isNaN)) {
        alert('No TV selected or available to play');
        return;
    }

    const busyTVs = targetTVs.filter(tvNum => hasActiveContent(tvNum));
    if (busyTVs.length > 0) {
        const tvNames = busyTVs.map(tvNum => `TV${tvNum}`).join(', ');
        if (!confirm(`${tvNames} is currently playing content. Replace with selected files?`)) {
            return;
        }
    }

    targetTVs.forEach(tvNum => {
        initSlideshowState(tvNum);
        slideshowState[tvNum].currentIndex = 0;
        slideshowState[tvNum].files = selectedFiles;
        slideshowState[tvNum].isPlaying = false;  // Start paused
        slideshowState[tvNum].isLooping = false;
        playCurrentSlideshowItem(tvNum);
        setPlayPauseUI(tvNum, false);  // Show paused state in UI
    });
}

// Delete selected files from Slideshow
function deleteSelectedSlideshowFiles() {
    const checkboxes = document.querySelectorAll('.slideshow-file-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Please select files to delete');
        return;
    }
    
    if (!confirm(`Delete ${checkboxes.length} file(s) from Slideshow?`)) {
        return;
    }
    
    checkboxes.forEach(cb => {
        deleteContent(cb.dataset.filename, cb.dataset.type, 'slideshow');
    });
}





