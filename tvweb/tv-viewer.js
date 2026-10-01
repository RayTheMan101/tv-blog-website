// TV Viewer Interface - Displays content on remote TV devices
// Connects to tv-management.js via connection codes and heartbeat sync
// Handles TV selection, video/picture playback, and slideshow display

let selectedTvNumber = null;
let syncIntervals = {}; // Separate sync timer for each TV
let connectionCode = null;
let checkConnectionInterval = null;
let heartbeatIntervals = {}; // Separate heartbeat timer per TV (sends alive/waiting status)
let availableTVs = []; // List of TVs from management server
let tvListPollInterval = null;
let reconnecting = false;
let cachedConnectionCodes = {}; // Saves connection codes per TV for faster reconnect
let cachedTvState = {}; // Caches current content being played per TV
let pendingTvParam = null; // URL parameter for TV selection
let syncConnected = {}; // Tracks connection state per TV

// Send closed heartbeat to disconnect from TV cleanly
function sendClosedHeartbeat(tvNum) {
    // Notify server that viewer is disconnecting
    if (!tvNum || !cachedConnectionCodes[tvNum]) return;
    
    try {
        const payload = JSON.stringify({
            tv_number: tvNum,
            connection_code: cachedConnectionCodes[tvNum],
            status: 'closed'
        });
        
        // Use sendBeacon for reliable delivery even during page unload
        if (navigator.sendBeacon) {
            navigator.sendBeacon('viewer-heartbeat.php', new Blob([payload], { type: 'application/json' }));
        } else {
            // Fallback for browsers without sendBeacon support
            fetch('viewer-heartbeat.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).catch(err => console.warn('Failed to send closed heartbeat:', err));
        }
    } catch (e) {
        console.warn('Error sending closed heartbeat:', e);
    }
}

// Stop all active processes for a specific TV
function stopTvProcesses(tvNum, clearCache = false) {
    if (!tvNum) return;
    if (syncIntervals[tvNum]) {
        clearInterval(syncIntervals[tvNum]);
        syncIntervals[tvNum] = null;
    }
    if (heartbeatIntervals[tvNum]) {
        clearInterval(heartbeatIntervals[tvNum]);
        heartbeatIntervals[tvNum] = null;
    }
    if (clearCache) {
        cachedConnectionCodes[tvNum] = null;
        cachedTvState[tvNum] = null;
        syncConnected[tvNum] = false;
    }
}

function sendHeartbeatStatus(tvNum, status = 'alive', code = '') {
    if (!tvNum) return;
    // Send heartbeat to dedicated endpoint with status (alive or waiting)
    fetch('viewer-heartbeat.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tv_number: tvNum, connection_code: code, status })
    }).catch(err => console.warn(`Heartbeat (${status}) error for TV ${tvNum}:`, err));
}

function toggleBackButton(show) {
    const btn = document.getElementById('backButton');
    if (btn) btn.style.display = show ? 'inline-flex' : 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Universal TV Viewer loaded');
    
    const enableSoundBtn = document.getElementById('enableSoundBtn');
    const backButton = document.getElementById('backButton');
    if (enableSoundBtn) {
        enableSoundBtn.addEventListener('click', function() {
            const videoPlayer = document.getElementById('videoPlayer');
            try {
                videoPlayer.muted = false;
                enableSoundBtn.style.display = 'none';
                const p = videoPlayer.play();
                if (p && typeof p.then === 'function') {
                    p.catch(err => console.warn('Play after enabling sound failed', err));
                }
            } catch (e) {
                console.warn('Enable sound handler error', e);
            }
        });
    }

    if (backButton) {
        backButton.addEventListener('click', function() {
            console.log('Back button clicked');
            // Use same logic as refresh: strip tv param and show picker
            const url = new URL(window.location.href);
            if (url.searchParams.has('tv')) {
                url.searchParams.delete('tv');
                window.history.replaceState({}, '', url.toString());
            }
            handleTvSelection(null);
        });
    }

    // Load available TVs from management page and populate tiles
    loadAvailableTVs();

    // Poll for TV list updates every 5 seconds to auto-detect added/removed TVs
    tvListPollInterval = setInterval(loadAvailableTVs, 5000);

    // Ignore URL tv param on refresh; always show picker and clean URL
    pendingTvParam = null;
    (function stripTvParamFromUrl() {
        const url = new URL(window.location.href);
        if (url.searchParams.has('tv')) {
            url.searchParams.delete('tv');
            window.history.replaceState({}, '', url.toString());
        }
    })();

    // Double-click anywhere to toggle fullscreen
    document.addEventListener('dblclick', function() {
        toggleFullscreen();
    });

    // Press 'F' key to toggle fullscreen
    document.addEventListener('keydown', function(e) {
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFullscreen();
        }
    });

    function toggleFullscreen() {
        try {
            if (!document.fullscreenElement) {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    elem.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        } catch (e) {
            console.warn('Fullscreen toggle error:', e);
        }
    }

    const videoPlayer = document.getElementById('videoPlayer');
    const pictureViewer = document.getElementById('pictureViewer');
    const applyFit = () => {
        const isFullscreen = !!document.fullscreenElement;
        const fit = 'contain';
        const width = isFullscreen ? '100vw' : '';
        const height = isFullscreen ? '100vh' : '';
        if (videoPlayer) {
            videoPlayer.style.objectFit = fit;
            videoPlayer.style.width = width;
            videoPlayer.style.height = height;
        }
        if (pictureViewer) {
            pictureViewer.style.objectFit = fit;
            pictureViewer.style.width = width;
            pictureViewer.style.height = height;
        }
        if (enableSoundBtn) {
            if (isFullscreen) {
                enableSoundBtn.dataset.prevDisplay = enableSoundBtn.style.display || '';
                enableSoundBtn.style.display = 'none';
            } else {
                enableSoundBtn.style.display = enableSoundBtn.dataset.prevDisplay || 'none';
            }
        }
        // Hide back button and status info in fullscreen
        const backBtn = document.getElementById('backButton');
        const statusInfo = document.getElementById('statusInfo');
        if (backBtn) {
            if (isFullscreen) {
                backBtn.dataset.prevDisplay = backBtn.style.display || '';
                backBtn.style.display = 'none';
            } else {
                backBtn.style.display = backBtn.dataset.prevDisplay || 'none';
            }
        }
        if (statusInfo) {
            if (isFullscreen) {
                statusInfo.dataset.prevDisplay = statusInfo.style.display || '';
                statusInfo.style.display = 'none';
            } else {
                statusInfo.style.display = statusInfo.dataset.prevDisplay || 'block';
            }
        }
    };
    document.addEventListener('fullscreenchange', applyFit);
    document.addEventListener('webkitfullscreenchange', applyFit);
    document.addEventListener('mozfullscreenchange', applyFit);
    document.addEventListener('MSFullscreenChange', applyFit);
});

function renderTvTiles(tvs) {
    const grid = document.getElementById('tvPickerGrid');
    const overlay = document.getElementById('tvPickerOverlay');
    const waitingMessage = document.getElementById('waitingMessage');
    grid.innerHTML = '';

    if (tvs && tvs.length) {
        tvs.forEach(tvNum => {
            const tile = document.createElement('div');
            tile.className = 'tv-tile';
            tile.textContent = `TV ${tvNum}`;
            tile.addEventListener('click', () => handleTvSelection(tvNum));
            grid.appendChild(tile);
        });
        overlay.style.display = 'flex';
        if (waitingMessage) waitingMessage.style.display = 'none';
        toggleBackButton(false);
    } else {
        // No TVs available; show a friendly message instead of hiding the picker
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'alert alert-warning w-100 text-center';
        emptyMsg.textContent = 'No Active or Present TV Available';
        grid.appendChild(emptyMsg);
        overlay.style.display = 'flex';
        if (waitingMessage) waitingMessage.style.display = 'none';
        toggleBackButton(false);
    }

    // No auto-select: always show picker after refresh
}

function loadAvailableTVs() {
    fetch('get-active-tvs.php')
        .then(response => response.json())
        .then(data => {
            if (data.tvs) {
                const newList = data.tvs;
                const prevList = availableTVs.join(',');
                availableTVs = newList;

                // If current selected TV was removed, force back to picker
                if (selectedTvNumber && !availableTVs.includes(selectedTvNumber)) {
                    alert(`TV ${selectedTvNumber} was removed. Returning to TV selection.`);
                    handleTvSelection(null);
                }

                // Re-render picker if overlay visible or list changed
                const listChanged = prevList !== availableTVs.join(',');
                const overlay = document.getElementById('tvPickerOverlay');
                const pickerVisible = overlay && overlay.style.display !== 'none';
                if (listChanged || pickerVisible || !selectedTvNumber) {
                    renderTvTiles(availableTVs);
                }
            }
        })
        .catch(err => {
            console.warn('Failed to load TV list:', err);
            setTimeout(loadAvailableTVs, 3000);
        });
}

function handleTvSelection(tvNumber) {
    const newTvNumber = tvNumber ? parseInt(tvNumber) : null;
    if (newTvNumber === selectedTvNumber) return;

    // If selecting a new TV, check if it's already connected to another device
    if (newTvNumber) {
        fetch(`check-tv-availability.php?tv=${newTvNumber}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.is_connected) {
                    alert(`TV${newTvNumber} is currently connected to another device and waiting for connection. Please choose a different TV.`);
                    return;
                }
                // TV is available, proceed with connection
                proceedWithTvSelection(newTvNumber);
            })
            .catch(err => {
                console.warn('Error checking TV availability:', err);
                // If check fails, allow connection anyway
                proceedWithTvSelection(newTvNumber);
            });
    } else {
        // Returning to picker (no TV selected)
        proceedWithTvSelection(null);
    }
}

function proceedWithTvSelection(newTvNumber) {
    // Send closed heartbeat for the previously selected TV before switching
    if (selectedTvNumber) {
        // Clear any waiting/alive heartbeat for previous TV
        sendHeartbeatStatus(selectedTvNumber, 'closed', cachedConnectionCodes[selectedTvNumber] || 'WAITING');
        stopTvProcesses(selectedTvNumber, true); // Clear cache to force new connection
    }
    if (checkConnectionInterval) {
        clearInterval(checkConnectionInterval);
        checkConnectionInterval = null;
    }

    // Update URL to reflect selected TV (shareable link). No persistence beyond current session.
    const url = new URL(window.location.href);
    if (newTvNumber) {
        url.searchParams.set('tv', newTvNumber);
    } else {
        url.searchParams.delete('tv');
    }
    window.history.replaceState({}, '', url.toString());

    // CRITICAL: Completely stop and reset video element before switching
    const videoPlayer = document.getElementById('videoPlayer');
    try {
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        videoPlayer.src = '';
        videoPlayer.load();
    } catch (e) {}

    selectedTvNumber = newTvNumber;

    if (newTvNumber) {
        document.getElementById('tvPickerOverlay').style.display = 'none';
        console.log('Selected TV:', selectedTvNumber);
        toggleBackButton(true);
        // Clear dataset COMPLETELY so displayContent treats it as a fresh load
        videoPlayer.dataset.currentFile = '';
        document.getElementById('pictureViewer').dataset.currentFile = '';

        // Always require a fresh connection code to avoid stale sessions
        connectionCode = null;
        cachedConnectionCodes[newTvNumber] = null;
        cachedTvState[newTvNumber] = null;
        syncConnected[newTvNumber] = false;

        clearDisplay();
        updateStatusInfo(`TV ${selectedTvNumber} | Polling for connection...`);
        // Start a waiting heartbeat so other devices know this TV is claimed
        startWaitingHeartbeat(selectedTvNumber);
        checkForConnectionCode();
    } else {
        // Returning to picker: stop all processes for previous TV and reset UI
        connectionCode = null;
        toggleBackButton(false);
        const waitingMessage = document.getElementById('waitingMessage');
        if (waitingMessage) {
            waitingMessage.textContent = 'Waiting for connection...';
            waitingMessage.style.display = 'none';
        }
        videoPlayer.style.display = 'none';
        document.getElementById('pictureViewer').style.display = 'none';
        updateStatusInfo('TV Viewer | Select a TV tile');
        document.getElementById('tvPickerOverlay').style.display = 'flex';
    }
}

function startWaitingHeartbeat(tvNum) {
    // Clear any prior waiting heartbeat interval for this TV
    if (heartbeatIntervals[tvNum]) {
        clearInterval(heartbeatIntervals[tvNum]);
        heartbeatIntervals[tvNum] = null;
    }
    // Send immediate waiting heartbeat and repeat every 3 seconds while waiting
    sendHeartbeatStatus(tvNum, 'waiting', 'WAITING');
    heartbeatIntervals[tvNum] = setInterval(() => {
        sendHeartbeatStatus(tvNum, 'waiting', 'WAITING');
    }, 3000);
}

function checkForConnectionCode() {
    if (!selectedTvNumber) {
        console.log('No TV selected');
        return;
    }

    const waitingMessage = document.getElementById('waitingMessage');
    if (waitingMessage) {
        waitingMessage.textContent = 'Waiting for connection...';
        waitingMessage.style.display = 'block';
    }

    const currentTvSnapshot = selectedTvNumber; // Capture which TV started this check
    // Clear any existing poll
    if (checkConnectionInterval) clearInterval(checkConnectionInterval);

    // Set 20-second timeout to return to picker if no connection
    const connectionTimeout = setTimeout(() => {
        if (selectedTvNumber === currentTvSnapshot && !connectionCode) {
            console.log('Connection timeout - no connection established in 20 seconds');
            if (checkConnectionInterval) {
                clearInterval(checkConnectionInterval);
                checkConnectionInterval = null;
            }
            alert(`Connection timeout: TV${currentTvSnapshot} did not connect within 20 seconds. Returning to TV selection...`);
            handleTvSelection(null); // Return to picker
            setTimeout(() => {
                window.location.reload(); // Auto-refresh to ensure UI resets to main page
            }, 300);
        }
    }, 20000); // 20 seconds

    const pollOnce = () => {
        // Only poll if we're still on the same TV
        if (selectedTvNumber !== currentTvSnapshot) {
            clearTimeout(connectionTimeout);
            return;
        }
        
        fetch(`get-viewer-code.php?tv=${selectedTvNumber}`)
            .then(response => response.json())
            .then(data => {
                // Double-check we didn't switch TVs during the fetch
                if (selectedTvNumber !== currentTvSnapshot) {
                    clearTimeout(connectionTimeout);
                    return;
                }
                
                if (data.success && data.connection_code) {
                    const code = data.connection_code;
                    connectionCode = code;
                    cachedConnectionCodes[selectedTvNumber] = code; // Cache it
                    console.log('Got connection code for TV ' + selectedTvNumber + ':', code);
                    clearInterval(checkConnectionInterval);
                    clearTimeout(connectionTimeout); // Clear timeout on successful connection
                    // Start syncing this TV
                    startSyncForTV(selectedTvNumber, code);
                }
            })
            .catch(err => console.warn('Error checking for connection code:', err));
    };

    // Poll immediately, then every 500ms
    pollOnce();
    checkConnectionInterval = setInterval(pollOnce, 500);
}

function startSyncForTV(tvNum, code) {
    // CRITICAL: Each TV syncs independently in background
    // Even if not selected, keep syncing so playback position advances on server
    
    // Stop existing sync for this TV if any
    if (syncIntervals[tvNum]) {
        clearInterval(syncIntervals[tvNum]);
    }
    if (heartbeatIntervals[tvNum]) {
        clearInterval(heartbeatIntervals[tvNum]);
    }
    
    // Reset connection flag for this TV; show waiting state until first successful sync
    syncConnected[tvNum] = false;

    // Only update status if this is the currently selected TV
    if (tvNum === selectedTvNumber) {
        const waitingMessage = document.getElementById('waitingMessage');
        updateStatusInfo(`TV ${tvNum} | Waiting for connection...`);
        if (waitingMessage) {
            waitingMessage.textContent = 'Waiting for connection...';
            waitingMessage.style.display = 'block';
        }
    }


    const syncContent = () => {
        // Sync this TV (even if not selected, to keep playback advancing)
        if (!code) return;
        
        fetch(`get-sync.php?connection_code=${encodeURIComponent(code)}&tv=${tvNum}`)
            .then(response => response.json())
            .then(data => {
                // Check if we were explicitly disconnected
                if (!data.success && data.disconnected) {
                    console.log(`TV ${tvNum} was disconnected by management page`);
                    // Stop syncing this TV
                    if (syncIntervals[tvNum]) {
                        clearInterval(syncIntervals[tvNum]);
                        syncIntervals[tvNum] = null;
                    }
                    if (heartbeatIntervals[tvNum]) {
                        clearInterval(heartbeatIntervals[tvNum]);
                        heartbeatIntervals[tvNum] = null;
                    }
                    // If this was the selected TV, show picker
                    if (tvNum === selectedTvNumber) {
                        connectionCode = null;
                        cachedConnectionCodes[tvNum] = null;
                        cachedTvState[tvNum] = null;
                        clearDisplay();
                        updateStatusInfo('Disconnected by management page');
                        setTimeout(() => {
                            handleTvSelection(null); // Show TV picker
                        }, 1000);
                    }
                    return;
                }
                
                if (data.success && data.data) {
                    // Mark as connected on first successful sync
                    if (!syncConnected[tvNum]) {
                        syncConnected[tvNum] = true;
                        if (tvNum === selectedTvNumber) {
                            updateStatusInfo(`TV ${tvNum} | Connected`);
                            const waitingMessage = document.getElementById('waitingMessage');
                            if (waitingMessage) waitingMessage.textContent = 'Connected';
                        }
                    }

                    // Cache the state for this TV
                    cachedTvState[tvNum] = data.data;
                    
                    // Only display if this is the currently selected TV
                    if (tvNum === selectedTvNumber) {
                        displayContent(data.data);
                    }
                }
                else if (tvNum === selectedTvNumber) {
                    // No active session; clear stale code and resume polling for a new one
                    syncConnected[tvNum] = false;
                    cachedConnectionCodes[tvNum] = null;
                    connectionCode = null;

                    // Stop current sync/heartbeat loops for this TV
                    if (syncIntervals[tvNum]) {
                        clearInterval(syncIntervals[tvNum]);
                        syncIntervals[tvNum] = null;
                    }
                    if (heartbeatIntervals[tvNum]) {
                        clearInterval(heartbeatIntervals[tvNum]);
                        heartbeatIntervals[tvNum] = null;
                    }

                    updateStatusInfo(`TV ${tvNum} | Waiting for connection...`);
                    const waitingMessage = document.getElementById('waitingMessage');
                    if (waitingMessage) {
                        waitingMessage.textContent = 'Waiting for connection...';
                        waitingMessage.style.display = 'block';
                    }

                    // Restart polling for the next connection code
                    checkForConnectionCode();
                }
            })
            .catch(err => console.warn(`Sync error for TV ${tvNum}:`, err));
    };

    // Start sync loop for this TV
    syncContent();
    syncIntervals[tvNum] = setInterval(syncContent, 500);
    
    // Start heartbeat for this TV (immediate + every 1s)
    updateHeartbeat(tvNum, code);
    heartbeatIntervals[tvNum] = setInterval(() => {
        updateHeartbeat(tvNum, code);
    }, 1000);
}

function displayContent(tvState) {
    const videoPlayer = document.getElementById('videoPlayer');
    const pictureViewer = document.getElementById('pictureViewer');
    const waitingMessage = document.getElementById('waitingMessage');
    const enableSoundBtn = document.getElementById('enableSoundBtn');

    if (!tvState.current_video && !tvState.current_picture) {
        try { videoPlayer.pause(); } catch (e) {}
        videoPlayer.src = '';
        pictureViewer.src = '';
        videoPlayer.style.display = 'none';
        pictureViewer.style.display = 'none';
        if (waitingMessage) {
            waitingMessage.textContent = 'Connected';
            waitingMessage.style.display = 'block';
        }
        updateStatusInfo(`TV ${selectedTvNumber} | Connected`);
        return;
    }

    if (waitingMessage) waitingMessage.style.display = 'none';

    if (tvState.current_video) {
        // Database already includes folder (e.g., 'content/file.mp4' or 'slideshow/file.mp4')
        const fullPath = 'uploads/' + tvState.current_video;
        const currentFile = videoPlayer.dataset.currentFile || '';
        
        if (currentFile !== fullPath) {
            try { videoPlayer.pause(); } catch (e) {}
            videoPlayer.currentTime = 0;
            videoPlayer.src = '';
            videoPlayer.load(); // Force browser to release all cached audio
            
            videoPlayer.dataset.currentFile = fullPath;
            videoPlayer.setAttribute('playsinline', '');
            videoPlayer.src = fullPath;
            pictureViewer.style.display = 'none';
            videoPlayer.style.display = 'block';
            
            videoPlayer.onloadedmetadata = function() {
                // Apply timestamp if provided
                const ts = parseFloat(tvState.video_timestamp || 0);
                if (!isNaN(ts) && Math.abs((videoPlayer.currentTime || 0) - ts) > 0.25) {
                    videoPlayer.currentTime = ts;
                }
                // Apply volume and speed
                if (tvState.video_volume !== undefined) videoPlayer.volume = tvState.video_volume;
                if (tvState.playback_speed !== undefined) videoPlayer.playbackRate = tvState.playback_speed;
                
                // Try autoplay; if blocked, mute and show enable-sound
                if (tvState.play_status === 'playing') {
                    const p = videoPlayer.play();
                    if (p && typeof p.then === 'function') {
                        p.catch(err => {
                            videoPlayer.muted = true;
                            if (enableSoundBtn && !document.fullscreenElement) enableSoundBtn.style.display = 'block';
                            videoPlayer.play().catch(() => {});
                        });
                    }
                } else if (tvState.play_status === 'paused') {
                    videoPlayer.pause();
                }
                
                // Enable-sound visibility
                if (enableSoundBtn) {
                    const vol = tvState.video_volume !== undefined ? tvState.video_volume : 1.0;
                    const showSound = (vol > 0 && videoPlayer.muted) && !document.fullscreenElement;
                    enableSoundBtn.style.display = showSound ? 'block' : 'none';
                }
            };
        } else {
            // Same file: update playback state only
            pictureViewer.style.display = 'none';
            videoPlayer.style.display = 'block';
            
            if (tvState.video_volume !== undefined) videoPlayer.volume = tvState.video_volume;
            if (tvState.playback_speed !== undefined) videoPlayer.playbackRate = tvState.playback_speed;
            
            // Handle play/pause state changes
                if (tvState.play_status === 'paused') {
                    // Always sync timestamp precisely while paused
                    const ts = parseFloat(tvState.video_timestamp || 0);
                    if (!isNaN(ts)) {
                        const curr = videoPlayer.currentTime || 0;
                        if (Math.abs(curr - ts) > 0.05) {
                            videoPlayer.currentTime = ts;
                        }
                    }
                    videoPlayer.pause();
                } else if (tvState.play_status === 'playing' && videoPlayer.paused) {
                    // State changed to playing - start playback
                    const p = videoPlayer.play();
                    if (p && typeof p.then === 'function') {
                        p.catch(err => {
                            videoPlayer.muted = true;
                            if (enableSoundBtn && !document.fullscreenElement) enableSoundBtn.style.display = 'block';
                            videoPlayer.play().catch(() => {});
                        });
                    }
                }
            if (enableSoundBtn) {
                const vol = tvState.video_volume !== undefined ? tvState.video_volume : 1.0;
                const showSound = (vol > 0 && videoPlayer.muted) && !document.fullscreenElement;
                enableSoundBtn.style.display = showSound ? 'block' : 'none';
            }
        }
        updateStatusInfo(`TV ${selectedTvNumber} | Playing video`);
    } else if (tvState.current_picture) {
        // Database already includes folder (e.g., 'content/file.jpg' or 'slideshow/file.jpg')
        const fullPath = 'uploads/' + tvState.current_picture;
        const currentPic = pictureViewer.dataset.currentFile || '';
        
        if (currentPic !== fullPath) {
            try { videoPlayer.pause(); } catch (e) {}
            videoPlayer.dataset.currentFile = '';
            pictureViewer.dataset.currentFile = fullPath;
            pictureViewer.src = fullPath;
            pictureViewer.style.display = 'block';
            videoPlayer.style.display = 'none';
        }
        if (enableSoundBtn) enableSoundBtn.style.display = 'none';
        updateStatusInfo(`TV ${selectedTvNumber} | Displaying picture`);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // M key toggles mute/unmute
    if (e.key === 'm' || e.key === 'M') {
        const videoPlayer = document.getElementById('videoPlayer');
        if (!videoPlayer) return;
        videoPlayer.muted = !videoPlayer.muted;
        // Hide enable-sound button when unmuted
        const enableSoundBtn = document.getElementById('enableSoundBtn');
        if (enableSoundBtn) {
            enableSoundBtn.style.display = videoPlayer.muted ? 'block' : 'none';
        }
    }
});

function clearDisplay() {
    const videoPlayer = document.getElementById('videoPlayer');
    const pictureViewer = document.getElementById('pictureViewer');
    const waitingMessage = document.getElementById('waitingMessage');

    videoPlayer.style.display = 'none';
    pictureViewer.style.display = 'none';
    waitingMessage.style.display = 'block';
    updateStatusInfo(`TV ${selectedTvNumber} | Waiting for content...`);
}

function updateStatusInfo(message) {
    document.getElementById('statusInfo').textContent = message;
}

function updateHeartbeat(tvNum, code, status = 'alive') {
    if (!tvNum) return;
    // Send heartbeat to dedicated endpoint
    fetch('viewer-heartbeat.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tv_number: tvNum, connection_code: code, status })
    }).catch(err => console.warn(`Heartbeat (${status}) error for TV ${tvNum}:`, err));
}

// Send a final disconnect beacon on page close to avoid delay
window.addEventListener('beforeunload', () => {
    try {
        if (selectedTvNumber && (cachedConnectionCodes[selectedTvNumber] || true)) {
            const payload = JSON.stringify({
                tv_number: selectedTvNumber,
                connection_code: cachedConnectionCodes[selectedTvNumber] || 'WAITING',
                status: 'closed'
            });
            navigator.sendBeacon('viewer-heartbeat.php', new Blob([payload], { type: 'application/json' }));
        }
    } catch (e) {}
});
