-- ==============================================================================
-- DENTALCARE NOTIFICATIONS TABLE & REALTIME RLS POLICIES
-- ==============================================================================
-- Execute this script in your Supabase SQL Editor:
-- Supabase Dashboard -> Select Project -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. CREATE NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    queue_id UUID REFERENCES public.queue(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CREATE PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON public.notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_patient_unread ON public.notifications(patient_id, is_read);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. CLEAN UP EXISTING POLICIES IF ANY
DROP POLICY IF EXISTS "Patients can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Patients can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow staff and admin to insert notifications" ON public.notifications;

-- 5. POLICY: PATIENTS CAN ONLY VIEW THEIR OWN NOTIFICATIONS
CREATE POLICY "Patients can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_id
    OR EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role IN ('admin', 'staff'))
    OR EXISTS (SELECT 1 FROM public.patient WHERE public.patient.id = auth.uid() AND public.patient.role IN ('admin', 'staff'))
);

-- 6. POLICY: PATIENTS CAN UPDATE THEIR OWN NOTIFICATIONS (MARK AS READ)
CREATE POLICY "Patients can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = patient_id)
WITH CHECK (auth.uid() = patient_id);

-- 7. POLICY: ADMINISTRATORS AND STAFF CAN INSERT NOTIFICATIONS FOR PATIENTS
CREATE POLICY "Admins can manage all notifications"
ON public.notifications FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role IN ('admin', 'staff'))
    OR EXISTS (SELECT 1 FROM public.patient WHERE public.patient.id = auth.uid() AND public.patient.role IN ('admin', 'staff'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role IN ('admin', 'staff'))
    OR EXISTS (SELECT 1 FROM public.patient WHERE public.patient.id = auth.uid() AND public.patient.role IN ('admin', 'staff'))
);

-- 8. ENABLE SUPABASE REALTIME REPLICATION FOR NOTIFICATIONS TABLE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;
