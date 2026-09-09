-- Serialize complete/cancel so a cancellation cannot delete an object that
-- another request has just accepted as immutable media.
ALTER TYPE "MediaUploadStatus" ADD VALUE 'PROCESSING' AFTER 'PENDING';
