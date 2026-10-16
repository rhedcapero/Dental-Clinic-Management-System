-- ==============================================================================
-- FIX PATIENT REGISTRATION & SUPABASE AUTH TRIGGER SCHEMA
-- ==============================================================================
-- Execute this script in your Supabase SQL Editor:
-- Supabase Dashboard -> Select your Project -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Ensure public.patient table exists
CREATE TABLE IF NOT EXISTS public.patient (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'staff', 'admin')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create compatibility view for public.profiles pointing to public.patient
-- This ensures that any queries or foreign references looking for 'profiles' resolve seamlessly.
CREATE OR REPLACE VIEW public.profiles AS 
SELECT * FROM public.patient;

-- 3. Function to handle new user signup from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.patient (id, full_name, email, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Patient'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        'patient'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone;

    RETURN NEW;
END;
$$;

-- 4. Trigger to execute handle_new_user on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Helper function for admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.admins
        WHERE user_id = auth.uid()
    );
END;
$$;

-- 6. Helper function for staff or admin check
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
        RETURN TRUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.patient WHERE id = auth.uid() AND role IN ('staff', 'admin')) THEN
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END;
$$;

-- 7. Enable RLS on public.patient
ALTER TABLE public.patient ENABLE ROW LEVEL SECURITY;

-- 8. Clean up old/conflicting RLS policies on public.patient
DROP POLICY IF EXISTS "Users can read own patient or admin can read all" ON public.patient;
DROP POLICY IF EXISTS "Users can read own profile or staff can read all" ON public.patient;
DROP POLICY IF EXISTS "Users can insert own patient" ON public.patient;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.patient;
DROP POLICY IF EXISTS "Users can update own patient" ON public.patient;
DROP POLICY IF EXISTS "Users can update own profile" ON public.patient;
DROP POLICY IF EXISTS "Admin can update all patient" ON public.patient;
DROP POLICY IF EXISTS "Staff and Admin can update all profiles" ON public.patient;
DROP POLICY IF EXISTS "Allow patient self read" ON public.patient;
DROP POLICY IF EXISTS "Allow patient self update" ON public.patient;
DROP POLICY IF EXISTS "Allow authenticated users to read patients" ON public.patient;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.patient;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.patient;

-- 9. Recreate clear, secure RLS policies on public.patient
-- Patients can read their own record, admins can read all, or today's queue viewers
CREATE POLICY "Users can read own patient or admin can read all"
ON public.patient FOR SELECT
TO authenticated
USING (
    auth.uid() = id 
    OR EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.queue WHERE queue.patient_id = patient.id AND queue.queue_date = CURRENT_DATE)
);

-- Patients can update their own profile (keeping role = 'patient')
CREATE POLICY "Users can update own patient"
ON public.patient FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = 'patient');

-- Admins can update any patient record
CREATE POLICY "Admin can update all patient"
ON public.patient FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));
