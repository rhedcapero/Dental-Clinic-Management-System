-- ==============================================================================
-- DENTAL CLINIC QUEUE MANAGEMENT SYSTEM - DATABASE SCHEMA & POLICIES
-- ==============================================================================
-- Execute this script in your Supabase SQL Editor:
-- Supabase Dashboard -> Select your Project -> SQL Editor -> New Query -> Run

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE PROFILES TABLE & COMPATIBILITY VIEWS
-- Some database instances created 'patient', others 'profiles'. We ensure both exist seamlessly.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'staff', 'admin')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    -- If 'patient' table exists but 'profiles' is missing, create a view 'profiles'
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patient') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.patient;
    END IF;
    -- If 'profiles' table exists but 'patient' is missing, create a view 'patient'
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patient') THEN
        CREATE OR REPLACE VIEW public.patient AS SELECT * FROM public.profiles;
    END IF;
END $$;

-- 3. CREATE ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREATE DENTAL SERVICES TABLE
CREATE TABLE IF NOT EXISTS public.dental_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    estimated_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. CREATE APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    service_id UUID REFERENCES public.dental_services(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CREATE QUEUE TABLE
CREATE TABLE IF NOT EXISTS public.queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    service_id UUID REFERENCES public.dental_services(id) ON DELETE SET NULL,
    queue_number INTEGER NOT NULL,
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'completed', 'skipped', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT unique_queue_per_day UNIQUE (queue_date, queue_number)
);

-- 7. POPULATE INITIAL DENTAL SERVICES (IF NOT PRESENT)
INSERT INTO public.dental_services (name, description, estimated_minutes, is_active)
SELECT 'Dental Check-up', 'Comprehensive oral examination and health assessment', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.dental_services WHERE name = 'Dental Check-up');

INSERT INTO public.dental_services (name, description, estimated_minutes, is_active)
SELECT 'Cleaning (Oral Prophylaxis)', 'Professional dental cleaning and plaque removal', 45, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.dental_services WHERE name = 'Cleaning (Oral Prophylaxis)');

INSERT INTO public.dental_services (name, description, estimated_minutes, is_active)
SELECT 'Tooth Extraction', 'Safe removal of decayed or problematic teeth', 40, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.dental_services WHERE name = 'Tooth Extraction');

INSERT INTO public.dental_services (name, description, estimated_minutes, is_active)
SELECT 'Tooth Filling', 'Restorative filling for cavities and damaged teeth', 45, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.dental_services WHERE name = 'Tooth Filling');

INSERT INTO public.dental_services (name, description, estimated_minutes, is_active)
SELECT 'Consultation', 'Expert advice and treatment planning with dentist', 15, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.dental_services WHERE name = 'Consultation');

INSERT INTO public.dental_services (name, description, estimated_minutes, is_active)
SELECT 'Oral Examination', 'Focused check-up for specific tooth pain or dental issue', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.dental_services WHERE name = 'Oral Examination');

-- 8. FUNCTION: AUTO CREATE PATIENT PROFILE ON USER SIGNUP
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

-- Trigger to execute on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. HELPER FUNCTIONS FOR ROLE AND PERMISSION CHECKS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    -- 1. Direct check in public.admins
    IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
        RETURN TRUE;
    END IF;
    -- 2. Direct check in public.patient
    IF EXISTS (SELECT 1 FROM public.patient WHERE id = auth.uid() AND role IN ('staff', 'admin')) THEN
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END;
$$;

-- 10. SAFE CONCURRENCY-LOCKED QUEUE TICKET GENERATION
CREATE OR REPLACE FUNCTION public.generate_queue_ticket(p_service_id UUID)
RETURNS JSONB
SET search_path = public
AS $$
DECLARE
    v_patient_id UUID;
    v_existing_active UUID;
    v_next_number INTEGER;
    v_new_record RECORD;
BEGIN
    v_patient_id := auth.uid();
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'You must be logged in to get a queue number.';
    END IF;

    -- Concurrency safety: acquire transaction-level lock for today's queue generation
    PERFORM pg_advisory_xact_lock(hashtext('daily_queue_' || CURRENT_DATE::text));

    -- Check if patient already has an active ticket today
    SELECT id INTO v_existing_active
    FROM public.queue
    WHERE patient_id = v_patient_id
      AND queue_date = CURRENT_DATE
      AND status IN ('waiting', 'serving')
    LIMIT 1;

    IF v_existing_active IS NOT NULL THEN
        RAISE EXCEPTION 'You already have an active queue number today.';
    END IF;

    -- Compute next number safely under lock
    SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next_number
    FROM public.queue
    WHERE queue_date = CURRENT_DATE;

    -- Insert new queue record
    INSERT INTO public.queue (patient_id, service_id, queue_number, queue_date, status)
    VALUES (v_patient_id, p_service_id, v_next_number, CURRENT_DATE, 'waiting')
    RETURNING * INTO v_new_record;

    RETURN to_jsonb(v_new_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient') THEN
        ALTER TABLE public.patient ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 12. RLS POLICIES FOR ADMINS TABLE
DROP POLICY IF EXISTS "Admins can view own admin record" ON public.admins;
CREATE POLICY "Admins can view own admin record"
ON public.admins FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 13. RLS POLICIES FOR PROFILES / PATIENT
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        DROP POLICY IF EXISTS "Users can read own profile or staff can read all" ON public.profiles;
        CREATE POLICY "Users can read own profile or staff can read all"
        ON public.profiles FOR SELECT
        TO authenticated
        USING (
            auth.uid() = id 
            OR EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.queue WHERE queue.patient_id = profiles.id AND queue.queue_date = CURRENT_DATE)
        );

        DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
        CREATE POLICY "Users can insert own profile"
        ON public.profiles FOR INSERT
        WITH CHECK (auth.uid() = id AND role = 'patient');

        DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
        CREATE POLICY "Users can update own profile"
        ON public.profiles FOR UPDATE
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id AND role = 'patient');

        DROP POLICY IF EXISTS "Staff and Admin can update all profiles" ON public.profiles;
        CREATE POLICY "Staff and Admin can update all profiles"
        ON public.profiles FOR UPDATE
        USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient') THEN
        DROP POLICY IF EXISTS "Users can read own patient or admin can read all" ON public.patient;
        CREATE POLICY "Users can read own patient or admin can read all"
        ON public.patient FOR SELECT
        TO authenticated
        USING (
            auth.uid() = id 
            OR EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.queue WHERE queue.patient_id = patient.id AND queue.queue_date = CURRENT_DATE)
        );

        DROP POLICY IF EXISTS "Users can insert own patient" ON public.patient;
        CREATE POLICY "Users can insert own patient"
        ON public.patient FOR INSERT
        WITH CHECK (auth.uid() = id AND role = 'patient');

        DROP POLICY IF EXISTS "Users can update own patient" ON public.patient;
        CREATE POLICY "Users can update own patient"
        ON public.patient FOR UPDATE
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id AND role = 'patient');

        DROP POLICY IF EXISTS "Admin can update all patient" ON public.patient;
        CREATE POLICY "Admin can update all patient"
        ON public.patient FOR UPDATE
        USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));
    END IF;
END $$;

-- 14. RLS POLICIES FOR DENTAL SERVICES
DROP POLICY IF EXISTS "Everyone can view active dental services" ON public.dental_services;
CREATE POLICY "Everyone can view active dental services"
ON public.dental_services FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Staff can insert/update services" ON public.dental_services;
CREATE POLICY "Staff can insert/update services"
ON public.dental_services FOR ALL
USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));

-- 15. RLS POLICIES FOR APPOINTMENTS
-- Administrators in public.admins can view all clinic appointments; patients can view their own
DROP POLICY IF EXISTS "Patients can view own appointments or staff can view all" ON public.appointments;
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admins
        WHERE public.admins.user_id = auth.uid()
    )
    OR patient_id = auth.uid()
);

DROP POLICY IF EXISTS "Patients can create own appointments" ON public.appointments;
CREATE POLICY "Patients can create own appointments"
ON public.appointments FOR INSERT
TO authenticated
WITH CHECK (
    patient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Patients can cancel own appointment or staff can manage" ON public.appointments;
CREATE POLICY "Patients can cancel own appointment or staff can manage"
ON public.appointments FOR UPDATE
TO authenticated
USING (
    patient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
)
WITH CHECK (
    patient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Staff can delete appointments" ON public.appointments;
CREATE POLICY "Staff can delete appointments"
ON public.appointments FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
);

-- 16. RLS POLICIES FOR QUEUE
DROP POLICY IF EXISTS "Authenticated users can view queue" ON public.queue;
DROP POLICY IF EXISTS "Anyone can view queue" ON public.queue;
CREATE POLICY "Anyone can view queue"
ON public.queue FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Patients can insert their queue" ON public.queue;
CREATE POLICY "Patients can insert their queue"
ON public.queue FOR INSERT
TO authenticated
WITH CHECK (
    patient_id = auth.uid()
);

DROP POLICY IF EXISTS "Staff can update queue status" ON public.queue;
CREATE POLICY "Staff can update queue status"
ON public.queue FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can delete queue entries" ON public.queue;
CREATE POLICY "Staff can delete queue entries"
ON public.queue FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid()));

-- 17. ENABLE REALTIME REPLICATION FOR QUEUE AND APPOINTMENTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.queue;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
END $$;

-- 18. CREATE NOTIFICATIONS TABLE & POLICIES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    queue_id UUID REFERENCES public.queue(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON public.notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_patient_unread ON public.notifications(patient_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view own notifications" ON public.notifications;
CREATE POLICY "Patients can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_id
    OR EXISTS (SELECT 1 FROM public.admins WHERE public.admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role IN ('admin', 'staff'))
    OR EXISTS (SELECT 1 FROM public.patient WHERE public.patient.id = auth.uid() AND public.patient.role IN ('admin', 'staff'))
);

DROP POLICY IF EXISTS "Patients can update own notifications" ON public.notifications;
CREATE POLICY "Patients can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = patient_id)
WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

