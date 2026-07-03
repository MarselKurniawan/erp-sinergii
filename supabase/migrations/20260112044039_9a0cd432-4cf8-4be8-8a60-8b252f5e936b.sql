-- Add password_changed_at column to profiles for tracking 2-week password change limit
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.password_changed_at IS 'Tracks when user last changed password. Users can only change password every 2 weeks unless admin resets it.';