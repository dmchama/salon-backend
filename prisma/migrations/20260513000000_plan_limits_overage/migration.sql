-- Add limits column to subscription_plans
ALTER TABLE `subscription_plans` ADD COLUMN `limits` JSON NULL;

-- Add is_overage column to bookings
ALTER TABLE `bookings` ADD COLUMN `is_overage` TINYINT(1) NOT NULL DEFAULT 0;

-- Create overage_pricing table
CREATE TABLE `overage_pricing` (
  `id`          VARCHAR(191) NOT NULL,
  `price_cents` INT          NOT NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create overage_invoices table
CREATE TABLE `overage_invoices` (
  `id`                  VARCHAR(191) NOT NULL,
  `owner_id`            VARCHAR(191) NOT NULL,
  `year`                INT          NOT NULL,
  `month`               INT          NOT NULL,
  `booking_limit`       INT          NOT NULL,
  `total_bookings`      INT          NOT NULL,
  `overage_count`       INT          NOT NULL,
  `overage_price_cents` INT          NOT NULL,
  `total_cents`         INT          NOT NULL,
  `status`              ENUM('DRAFT','SENT','PAID','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `sent_at`             DATETIME(3) NULL,
  `paid_at`             DATETIME(3) NULL,
  `notes`               LONGTEXT     NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `overage_invoices_owner_id_year_month_key`(`owner_id`, `year`, `month`),
  INDEX `overage_invoices_owner_id_idx`(`owner_id`),
  INDEX `overage_invoices_status_idx`(`status`),
  CONSTRAINT `overage_invoices_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
