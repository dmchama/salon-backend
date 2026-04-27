-- Expand role enum for in-place migration
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('ADMIN','OWNER','CUSTOMER','SUPER_ADMIN','SALON_ADMIN') NOT NULL;

UPDATE `users` SET `role` = 'SUPER_ADMIN' WHERE `role` = 'ADMIN';
UPDATE `users` SET `role` = 'SALON_ADMIN' WHERE `role` = 'OWNER';

ALTER TABLE `bookings` DROP FOREIGN KEY `bookings_customer_id_fkey`;

ALTER TABLE `bookings` ADD COLUMN `guest_name` VARCHAR(191) NULL;
ALTER TABLE `bookings` ADD COLUMN `guest_email` VARCHAR(191) NULL;
ALTER TABLE `bookings` ADD COLUMN `guest_phone` VARCHAR(191) NULL;

UPDATE `bookings` AS `b` INNER JOIN `users` AS `u` ON `b`.`customer_id` = `u`.`id`
SET
  `b`.`guest_email` = `u`.`email`,
  `b`.`guest_name` = CASE
    WHEN TRIM(CONCAT(COALESCE(`u`.`first_name`,''), ' ', COALESCE(`u`.`last_name`,''))) <> '' THEN TRIM(CONCAT(COALESCE(`u`.`first_name`,''), ' ', COALESCE(`u`.`last_name`,'')))
    ELSE 'Guest'
  END,
  `b`.`guest_phone` = CASE WHEN NULLIF(TRIM(`u`.`phone`), '') IS NULL THEN '-' ELSE TRIM(`u`.`phone`) END
WHERE `u`.`role` = 'CUSTOMER';

UPDATE `bookings` AS `b` INNER JOIN `users` AS `u` ON `b`.`customer_id` = `u`.`id`
SET `b`.`customer_id` = NULL
WHERE `u`.`role` = 'CUSTOMER';

DELETE FROM `users` WHERE `role` = 'CUSTOMER';

ALTER TABLE `bookings` MODIFY `customer_id` VARCHAR(191) NULL;

ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `users` MODIFY COLUMN `role` ENUM('SUPER_ADMIN','SALON_ADMIN') NOT NULL;
