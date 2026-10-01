-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 28, 2026 at 01:41 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `bbccc_tv_account`
--

-- --------------------------------------------------------

--
-- Table structure for table `tv_sessions`
--

CREATE TABLE `tv_sessions` (
  `id` int(11) NOT NULL,
  `tv_number` int(11) NOT NULL,
  `connection_code` varchar(6) NOT NULL,
  `viewer_connected` tinyint(1) DEFAULT 0,
  `current_video` varchar(500) DEFAULT NULL,
  `current_picture` varchar(500) DEFAULT NULL,
  `play_status` enum('playing','paused','stopped') DEFAULT 'stopped',
  `video_volume` int(11) DEFAULT 100,
  `playback_speed` decimal(3,2) DEFAULT 1.00,
  `loop_enabled` tinyint(1) DEFAULT 0,
  `fullscreen_request` varchar(10) DEFAULT NULL,
  `fullscreen_status` tinyint(1) DEFAULT 0,
  `video_timestamp` decimal(10,3) DEFAULT 0.000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tv_sessions`
--

INSERT INTO `tv_sessions` (`id`, `tv_number`, `connection_code`, `viewer_connected`, `current_video`, `current_picture`, `play_status`, `video_volume`, `playback_speed`, `loop_enabled`, `fullscreen_request`, `fullscreen_status`, `video_timestamp`, `created_at`, `updated_at`) VALUES
(1, 1, 'TV1-87', 0, NULL, NULL, 'paused', 1, 1.00, 0, NULL, 0, 2.068, '2026-01-27 06:31:53', '2026-01-27 06:31:55');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`, `created_at`) VALUES
(3, 'Rhon', '123456', 'admin', '2026-01-27 06:31:23');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tv_sessions`
--
ALTER TABLE `tv_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tv_number` (`tv_number`),
  ADD UNIQUE KEY `connection_code` (`connection_code`),
  ADD KEY `idx_connection_code` (`connection_code`),
  ADD KEY `idx_tv_number` (`tv_number`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tv_sessions`
--
ALTER TABLE `tv_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
