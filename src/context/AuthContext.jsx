import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  adminSupabase,
  patientSupabase,
  supabase,
  isSupabaseConfigured,
  getActiveSupabase,
} from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const location = useLocation();

  // Determine current active portal from the browser route
  const isAdminPortal = useMemo(() => {
    const path = location?.pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');
    return path.startsWith('/admin') || path.startsWith('/staff');
  }, [location?.pathname]);

  // Administrator state (isolated to adminSupabase / dentalcare_admin_auth_token)
  const [adminUser, setAdminUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  // Patient state (isolated to patientSupabase / dentalcare_patient_auth_token)
  const [patientUser, setPatientUser] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [patientLoading, setPatientLoading] = useState(true);

  // Helper to verify if a user's ID exists in the public.admins table
  const checkAdminStatus = useCallback(async (userId, client = adminSupabase) => {
    if (!userId || !isSupabaseConfigured) return false;
    try {
      const { data, error } = await client
        .from('admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Admin status query notice:', error.message);
        return false;
      }
      return Boolean(data && data.user_id);
    } catch (err) {
      console.error('Unexpected error checking admin table:', err);
      return false;
    }
  }, []);

  // Helper to fetch user's profile from the 'patient' or 'profiles' table
  const fetchProfile = useCallback(async (userId, client = patientSupabase) => {
    if (!userId || !isSupabaseConfigured) return null;

    try {
      let { data, error } = await client
        .from('patient')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && (error.message?.includes('patient') || error.message?.includes('relation') || error.message?.includes('schema cache'))) {
        const profileRes = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (!profileRes.error) {
          data = profileRes.data;
          error = null;
        }
      }

      if (error) {
        console.error('Error fetching profile:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      return null;
    }
  }, []);

  // Synchronize Administrator session state
  const syncAdminUserState = useCallback(async (currentUser) => {
    if (!currentUser) {
      setAdminUser(null);
      setAdminProfile(null);
      setIsAdminVerified(false);
      return { adminStatus: false, userProfile: null };
    }

    try {
      const [adminStatus, userProfile] = await Promise.all([
        checkAdminStatus(currentUser.id, adminSupabase),
        fetchProfile(currentUser.id, adminSupabase),
      ]);

      if (!adminStatus) {
        // Authenticated in Auth, but missing from public.admins table -> Disallow admin session
        console.warn('User session is not registered in public.admins. Clearing admin session.');
        setAdminUser(null);
        setAdminProfile(null);
        setIsAdminVerified(false);
        try {
          await adminSupabase.auth.signOut();
        } catch (e) {
          // ignore
        }
        return { adminStatus: false, userProfile: null };
      }

      setAdminUser(currentUser);
      setIsAdminVerified(true);

      const resolvedProfile = {
        ...(userProfile || {}),
        role: 'admin',
        full_name: (userProfile?.full_name && userProfile.full_name !== 'Patient')
          ? userProfile.full_name
          : 'Administrator',
      };
      setAdminProfile(resolvedProfile);

      // Keep public.patient role synchronized in background
      if (userProfile && userProfile.role !== 'admin') {
        adminSupabase
          .from('patient')
          .update({ role: 'admin', full_name: resolvedProfile.full_name })
          .eq('id', currentUser.id)
          .then(({ error: syncErr }) => {
            if (syncErr) console.warn('Admin role sync notice:', syncErr.message);
          });
      }

      return { adminStatus: true, userProfile: resolvedProfile };
    } catch (err) {
      console.error('Error synchronizing admin user state:', err);
      return { adminStatus: false, userProfile: null };
    }
  }, [checkAdminStatus, fetchProfile]);

  // Synchronize Patient session state
  const syncPatientUserState = useCallback(async (currentUser) => {
    if (!currentUser) {
      setPatientUser(null);
      setPatientProfile(null);
      return null;
    }

    try {
      // Security role check: Prevent an admin account from being treated as a patient session
      const isUserAdmin = await checkAdminStatus(currentUser.id, patientSupabase);
      if (isUserAdmin) {
        console.warn('Admin account detected in patient auth scope. Clearing patient auth.');
        setPatientUser(null);
        setPatientProfile(null);
        try {
          await patientSupabase.auth.signOut();
        } catch (e) {
          // ignore
        }
        return null;
      }

      setPatientUser(currentUser);
      const userProfile = await fetchProfile(currentUser.id, patientSupabase);
      setPatientProfile(userProfile);
      return userProfile;
    } catch (err) {
      console.error('Error synchronizing patient user state:', err);
      return null;
    }
  }, [checkAdminStatus, fetchProfile]);

  // 1. Initialize Administrator Auth Listener (independent from patient session)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAdminLoading(false);
      return;
    }

    let isMounted = true;

    adminSupabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      await syncAdminUserState(currentUser);
      if (isMounted) setAdminLoading(false);
    }).catch((err) => {
      console.error('Failed to get admin session:', err);
      if (isMounted) setAdminLoading(false);
    });

    const { data: { subscription } } = adminSupabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        const currentUser = session?.user ?? null;
        await syncAdminUserState(currentUser);
        if (isMounted) setAdminLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [syncAdminUserState]);

  // 2. Initialize Patient Auth Listener (independent from administrator session)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPatientLoading(false);
      return;
    }

    let isMounted = true;

    patientSupabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      await syncPatientUserState(currentUser);
      if (isMounted) setPatientLoading(false);
    }).catch((err) => {
      console.error('Failed to get patient session:', err);
      if (isMounted) setPatientLoading(false);
    });

    const { data: { subscription } } = patientSupabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        const currentUser = session?.user ?? null;
        await syncPatientUserState(currentUser);
        if (isMounted) setPatientLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [syncPatientUserState]);

  // Dedicated Register for Patient Portal
  const registerPatient = async ({ email, password, fullName, phone }) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured yet. Please configure your .env file.');
    }

    const { data, error } = await patientSupabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          role: 'patient',
        },
      },
    });

    if (error) throw error;

    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists.');
    }

    if (data?.session && data?.user) {
      await syncPatientUserState(data.user);
    }

    return data;
  };

  // Dedicated Admin Login: Signs into adminSupabase, verifies public.admins status
  const loginAdmin = async (email, password) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured yet. Please configure your .env file.');
    }

    const { data, error } = await adminSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data?.user) throw new Error('Failed to retrieve administrator user.');

    // Security check: Verify user exists in public.admins
    const isUserAdmin = await checkAdminStatus(data.user.id, adminSupabase);
    if (!isUserAdmin) {
      await adminSupabase.auth.signOut();
      setAdminUser(null);
      setAdminProfile(null);
      setIsAdminVerified(false);
      throw new Error('Access denied. Administrator account required.');
    }

    await syncAdminUserState(data.user);
    return data;
  };

  // Dedicated Patient Login: Signs into patientSupabase, prevents admin from taking over patient session
  const loginPatient = async (email, password) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured yet. Please configure your .env file.');
    }

    const { data, error } = await patientSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data?.user) throw new Error('Failed to retrieve patient user.');

    // Security check: Prevent an administrator account from taking over patient session
    const isUserAdmin = await checkAdminStatus(data.user.id, patientSupabase);
    if (isUserAdmin) {
      await patientSupabase.auth.signOut();
      setPatientUser(null);
      setPatientProfile(null);
      throw new Error('This account is registered as an administrator. Please log in using the Administrator Portal at /admin/login.');
    }

    await syncPatientUserState(data.user);
    return data;
  };

  // Dedicated Login: Routes to loginAdmin if on Admin Portal, or loginPatient if on Patient Portal
  const login = async (email, password) => {
    if (isAdminPortal) {
      return loginAdmin(email, password);
    }
    return loginPatient(email, password);
  };

  // Dedicated Logout: Clears session ONLY for the portal calling logout
  const logoutAdmin = async () => {
    if (!isSupabaseConfigured) return;
    try {
      await adminSupabase.auth.signOut();
    } catch (err) {
      console.error('Admin sign out error:', err?.message || err);
    } finally {
      setAdminUser(null);
      setAdminProfile(null);
      setIsAdminVerified(false);
    }
  };

  const logoutPatient = async () => {
    if (!isSupabaseConfigured) return;
    try {
      await patientSupabase.auth.signOut();
    } catch (err) {
      console.error('Patient sign out error:', err?.message || err);
    } finally {
      setPatientUser(null);
      setPatientProfile(null);
    }
  };

  const logout = async () => {
    if (isAdminPortal) {
      await logoutAdmin();
    } else {
      await logoutPatient();
    }
  };

  // Update profile for current active user in current portal
  const updateProfile = async ({ fullName, phone }) => {
    const activeClient = isAdminPortal ? adminSupabase : patientSupabase;
    const activeUser = isAdminPortal ? adminUser : patientUser;

    if (!activeUser) throw new Error('No user is currently logged in.');

    let { data, error } = await activeClient
      .from('patient')
      .update({
        full_name: fullName,
        phone: phone,
      })
      .eq('id', activeUser.id)
      .select()
      .maybeSingle();

    if (error && (error.message?.includes('patient') || error.message?.includes('relation'))) {
      const res = await activeClient
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
        })
        .eq('id', activeUser.id)
        .select()
        .maybeSingle();
      data = res.data;
      error = res.error;
    }

    if (error) throw error;

    if (isAdminPortal) {
      setAdminProfile(data);
    } else {
      setPatientProfile(data);
    }
    return data;
  };

  // Compute portal-aware values
  const user = isAdminPortal ? adminUser : patientUser;
  const profile = isAdminPortal ? adminProfile : patientProfile;
  const loading = isAdminPortal ? adminLoading : patientLoading;

  // Strict role separation: isAdmin is true ONLY on the Admin Portal and if admin is verified
  const isAdmin = Boolean(isAdminPortal && isAdminVerified);
  const isStaff = isAdmin;
  const isPatient = Boolean(!isAdminPortal && patientUser);

  const value = {
    // Current portal active state
    user,
    profile,
    loading,
    isAdmin,
    isStaff,
    isPatient,
    isAdminPortal,

    // Specific portal states for advanced usage
    adminUser,
    adminProfile,
    isAdminVerified,
    patientUser,
    patientProfile,
    adminLoading,
    patientLoading,

    // Operations
    registerPatient,
    login,
    loginAdmin,
    loginPatient,
    logout,
    logoutAdmin,
    logoutPatient,
    updateProfile,
    checkAdminStatus,
    syncAdminUserState,
    syncPatientUserState,
    refreshAuth: async () => {
      if (isAdminPortal) {
        const { data: { session } } = await adminSupabase.auth.getSession();
        return session?.user ? syncAdminUserState(session.user) : Promise.resolve({ adminStatus: false, userProfile: null });
      }
      const { data: { session } } = await patientSupabase.auth.getSession();
      return session?.user ? syncPatientUserState(session.user) : Promise.resolve(null);
    },
    refreshProfile: () => {
      if (isAdminPortal) {
        return adminUser ? fetchProfile(adminUser.id, adminSupabase) : Promise.resolve(null);
      }
      return patientUser ? fetchProfile(patientUser.id, patientSupabase) : Promise.resolve(null);
    },

    // Clients
    adminSupabase,
    patientSupabase,
    supabase: getActiveSupabase(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

