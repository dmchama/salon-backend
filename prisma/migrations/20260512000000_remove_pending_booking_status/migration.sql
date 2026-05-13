-- Migrate existing PENDING bookings to CONFIRMED before removing the enum value
UPDATE `bookings` SET `status` = 'CONFIRMED' WHERE `status` = 'PENDING';

-- Remove PENDING from BookingStatus enum and update default to CONFIRMED
ALTER TABLE `bookings` MODIFY COLUMN `status` ENUM('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW') NOT NULL DEFAULT 'CONFIRMED';
