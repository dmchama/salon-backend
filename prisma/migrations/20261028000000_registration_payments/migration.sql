-- CreateTable
CREATE TABLE `registration_payments` (
    `id` VARCHAR(191) NOT NULL,
    `owner_id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `amount_cents` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `receipt_public_id` VARCHAR(191) NOT NULL,
    `receipt_format` VARCHAR(10) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejection_reason` TEXT NULL,
    `reviewed_by_id` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `registration_payments_owner_id_created_at_idx`(`owner_id`, `created_at`),
    INDEX `registration_payments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `registration_payments` ADD CONSTRAINT `registration_payments_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registration_payments` ADD CONSTRAINT `registration_payments_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registration_payments` ADD CONSTRAINT `registration_payments_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Mock payment details (feature 002, BR14). INSERT IGNORE never overwrites real details.
INSERT IGNORE INTO `website_settings` (`key`, `value`, `updated_at`) VALUES (
    'paymentDetails',
    JSON_OBJECT(
        'bankName', 'Sample Bank PLC',
        'accountName', 'SaloonBooking (Pvt) Ltd — SAMPLE',
        'accountNumber', '0000 1111 2222',
        'branch', 'Colombo 03 (sample)',
        'instructions', 'SAMPLE DETAILS — do not pay. Use your email address as the payment reference.'
    ),
    CURRENT_TIMESTAMP(3)
);
