-- AlterTable: add phone to User if not already present
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='phone') THEN
    ALTER TABLE "User" ADD COLUMN "phone" TEXT;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN IF NOT EXISTS "phone" TEXT;
