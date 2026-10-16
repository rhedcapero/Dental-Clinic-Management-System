-- ==============================================================================
-- PATIENT LOGS TABLE & RLS POLICIES FOR DENTALCARE SYSTEM
-- ==============================================================================
-- Execute this script in your Supabase SQL Editor:
-- Supabase Dashboard -> Select Project -> SQL Editor -> New Query -> Run
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.patient_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    patient_name TEXT NOT NULL,
    patient_email TEXT,
    patient_phone TEXT,
    appointment_id UUID,
    queue_id UUID,
    service_name TEXT,
    appointment_date DATE,
    appointment_time TIME,
    checkup_start_time TIMESTAMPTZ,
    checkup_completed_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Not Started',
    archived_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    appointment_details JSONB DEFAULT '[]'::jsonb,
    queue_details JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for high-performance search and sorting
CREATE INDEX IF NOT EXISTS idx_patient_logs_patient_id ON public.patient_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_logs_archived_at ON public.patient_logs(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_logs_status ON public.patient_logs(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.patient_logs ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Admins can manage patient logs" ON public.patient_logs;
DROP POLICY IF EXISTS "Allow authenticated users to read logs" ON public.patient_logs;
DROP POLICY IF EXISTS "Allow staff and admin to manage logs" ON public.patient_logs;

-- Policy: Administrators and staff can view, insert, update, or delete patient logs
CREATE POLICY "Admins can manage patient logs"
ON public.patient_logs FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role IN ('admin', 'staff'))
    OR
    EXISTS (SELECT 1 FROM public.patient WHERE public.patient.id = auth.uid() AND public.patient.role IN ('admin', 'staff'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role IN ('admin', 'staff'))
    OR
    EXISTS (SELECT 1 FROM public.patient WHERE public.patient.id = auth.uid() AND public.patient.role IN ('admin', 'staff'))
);

-- Backward compatibility: Ensure patient_history table also exists for legacy references
CREATE TABLE IF NOT EXISTS public.patient_history (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'patient',
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.patient_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage patient history" ON public.patient_history;

CREATE POLICY "Admins can manage patient history"
ON public.patient_history FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role IN ('admin', 'staff'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role IN ('admin', 'staff'))
);
