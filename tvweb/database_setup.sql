-- Copy paste lng to para madali

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS bbccc_tv_account;
USE bbccc_tv_account;

-- Users table - stores login credentials and user roles
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username)
);

-- TV Sessions table - tracks TV connections and playback state
CREATE TABLE IF NOT EXISTS tv_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tv_number INT NOT NULL UNIQUE,
    connection_code VARCHAR(6) NOT NULL UNIQUE,
    viewer_connected TINYINT(1) DEFAULT 0,
    current_video VARCHAR(500),
    current_picture VARCHAR(500),
    play_status ENUM('playing', 'paused', 'stopped') DEFAULT 'stopped',
    video_volume INT DEFAULT 100,
    playback_speed DECIMAL(3, 2) DEFAULT 1.00,
    loop_enabled TINYINT(1) DEFAULT 0,
    fullscreen_request VARCHAR(10),
    fullscreen_status TINYINT(1) DEFAULT 0,
    video_timestamp DECIMAL(10, 3) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_connection_code (connection_code),
    INDEX idx_tv_number (tv_number)
);

-- Insert default users (optional - adjust as needed)
INSERT INTO users (username, password, role) VALUES
('admin', SHA2('admin', 256), 'admin'),
('user', SHA2('user', 256), 'user')
ON DUPLICATE KEY UPDATE username=VALUES(username);

-- Just copy all and paste it into mysql