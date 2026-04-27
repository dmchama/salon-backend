-- AlterTable
ALTER TABLE `salons` ADD COLUMN `contact_phone` VARCHAR(40) NULL,
ADD COLUMN `contact_email` VARCHAR(255) NULL,
ADD COLUMN `website_url` VARCHAR(2048) NULL,
ADD COLUMN `business_hours` JSON NULL;
