-- CreateTable
CREATE TABLE `technicians` (
    `id` VARCHAR(191) NOT NULL,
    `salon_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `specialization` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `technicians_salon_id_idx`(`salon_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `technicians` ADD CONSTRAINT `technicians_salon_id_fkey` FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `technician_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `bookings_technician_id_idx` ON `bookings`(`technician_id`);

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_technician_id_fkey` FOREIGN KEY (`technician_id`) REFERENCES `technicians`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
