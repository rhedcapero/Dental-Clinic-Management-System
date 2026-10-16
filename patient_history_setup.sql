-- ==============================================================================
-- PATIENT HISTORY (ARCHIVE) TABLE & RLS POLICIES
-- ==============================================================================
-- Run this script in your Supabase SQL Editor if you wish to persist archived
-- patients directly in the PostgreSQL database:
-- Supabase Dashboard -> Select Project -> SQL Editor -> New Query -> Run
-- ==============================================================================

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

-- Enable Row Level Security
ALTER TABLE public.patient_history ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Admins can manage patient history" ON public.patient_history;
DROP POLICY IF EXISTS "Admins can select patient history" ON public.patient_history;
DROP POLICY IF EXISTS "Admins can insert patient history" ON public.patient_history;
DROP POLICY IF EXISTS "Admins can update patient history" ON public.patient_history;
DROP POLICY IF EXISTS "Admins can delete patient history" ON public.patient_history;

-- Policy: Only administrators can read, insert, update, or delete from patient_history
CREATE POLICY "Admins can manage patient history"
ON public.patient_history FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
);
