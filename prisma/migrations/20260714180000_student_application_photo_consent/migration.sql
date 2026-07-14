-- Guardian consent to publicly display the student's (watermarked) photo.
-- Gates portraitConsent=GRANTED at approval and is required to submit an application.
ALTER TABLE "StudentApplication" ADD COLUMN "photoConsent" BOOLEAN NOT NULL DEFAULT false;
