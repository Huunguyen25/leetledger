"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PROFILES } from "@/lib/dashboard/profiles";
import {
  getDashboardSession,
  isDashboardConfigured,
  loadLatestTimelineArchive,
  listDashboardReviews,
  readCachedReviews,
  requestDashboardSignInOtp,
  requestDashboardSignUpOtp,
  signOutDashboard,
  subscribeToDashboardAuth,
  verifyDashboardOtp,
} from "@/lib/dashboard/repository";
import type {
  ProblemReview,
  ProfileDefinition,
  SubmissionArchive,
} from "@/lib/dashboard/types";

interface DashboardContextValue {
  problems: ProblemReview[];
  archives: SubmissionArchive[];
  profiles: ProfileDefinition[];
  activeProfile: ProfileDefinition;
  setActiveProfileId: (id: string) => void;
  selectedProblem: ProblemReview | null;
  openProblem: (problem: ProblemReview) => void;
  closeProblem: () => void;
  authConfigured: boolean;
  sessionEmail: string | null;
  sessionUserId: string | null;
  dataStatus:
    | "unconfigured"
    | "checking"
    | "signed-out"
    | "cache"
    | "live"
    | "error";
  dataError: string | null;
  loadArchive: (problemSlug: string) => Promise<SubmissionArchive | null>;
  requestSignInOtp: (email: string, password: string) => Promise<void>;
  requestSignUpOtp: (email: string, password: string) => Promise<void>;
  verifyOtp: (
    email: string,
    token: string,
    type: "email" | "signup",
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const authConfigured = isDashboardConfigured();
  const [activeProfileId, setProfileId] = useState("general");
  const [problems, setProblems] = useState<ProblemReview[]>([]);
  const [archives, setArchives] = useState<SubmissionArchive[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<DashboardContextValue["dataStatus"]>(
    authConfigured ? "checking" : "unconfigured",
  );
  const [dataError, setDataError] = useState<string | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<ProblemReview | null>(
    null,
  );

  useEffect(() => {
    const saved = window.localStorage.getItem("leetledger-profile");
    if (!saved || !PROFILES.some((profile) => profile.id === saved)) return;
    const frame = window.requestAnimationFrame(() => setProfileId(saved));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authConfigured) return;
    let active = true;

    async function loadSession() {
      try {
        const session = await getDashboardSession();
        if (!active) return;
        await applySession(session);
      } catch (error) {
        if (active) {
          setDataError(errorMessage(error));
          setDataStatus("error");
        }
      }
    }

    async function applySession(
      session: Awaited<ReturnType<typeof getDashboardSession>>,
    ) {
      if (!active) return;
      if (!session) {
        setSessionEmail(null);
        setSessionUserId(null);
        setProblems([]);
        setArchives([]);
        setDataStatus("signed-out");
        setDataError(null);
        return;
      }

      setSessionEmail(session.user.email ?? "Signed-in account");
      setSessionUserId(session.user.id);
      setArchives([]);
      const cached = readCachedReviews(session.user.id);
      if (cached) {
        setProblems(cached.reviews);
        setDataStatus("cache");
      }

      try {
        const reviews = await listDashboardReviews(session.user.id);
        if (!active) return;
        setProblems(reviews);
        setDataStatus("live");
        setDataError(null);
      } catch (error) {
        if (active) {
          setDataError(errorMessage(error));
          if (!cached) setDataStatus("error");
        }
      }
    }

    void loadSession();
    const unsubscribe = subscribeToDashboardAuth((session) => {
      void applySession(session);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [authConfigured]);

  const setActiveProfileId = useCallback((id: string) => {
    setProfileId(id);
    window.localStorage.setItem("leetledger-profile", id);
  }, []);

  const openProblem = useCallback((problem: ProblemReview) => {
    setSelectedProblem(problem);
  }, []);

  const closeProblem = useCallback(() => setSelectedProblem(null), []);

  const requestSignInOtp = useCallback(async (email: string, password: string) => {
    setDataError(null);
    try {
      await requestDashboardSignInOtp(email, password);
    } catch (error) {
      const message = errorMessage(error);
      setDataError(message);
      throw new Error(message);
    }
  }, []);

  const requestSignUpOtp = useCallback(async (email: string, password: string) => {
    setDataError(null);
    try {
      await requestDashboardSignUpOtp(email, password);
    } catch (error) {
      const message = errorMessage(error);
      setDataError(message);
      throw new Error(message);
    }
  }, []);

  const verifyOtp = useCallback(async (
    email: string,
    token: string,
    type: "email" | "signup",
  ) => {
    setDataError(null);
    try {
      await verifyDashboardOtp(email, token, type);
    } catch (error) {
      const message = errorMessage(error);
      setDataError(message);
      throw new Error(message);
    }
  }, []);

  const signOut = useCallback(async () => {
    setDataError(null);
    try {
      await signOutDashboard();
    } catch (error) {
      const message = errorMessage(error);
      setDataError(message);
      throw new Error(message);
    }
  }, []);

  const loadArchive = useCallback(
    async (problemSlug: string) => {
      if (!sessionUserId) return null;
      const existing = archives.find(
        (archive) => archive.problemSlug === problemSlug,
      );
      if (existing) return existing;
      const archive = await loadLatestTimelineArchive(
        sessionUserId,
        problemSlug,
      );
      if (archive) {
        setArchives((current) => [
          ...current.filter(
            (item) => item.problemSlug !== archive.problemSlug,
          ),
          archive,
        ]);
      }
      return archive;
    },
    [archives, sessionUserId],
  );

  const value = useMemo(
    () => ({
      problems,
      archives,
      profiles: PROFILES,
      activeProfile:
        PROFILES.find((profile) => profile.id === activeProfileId) ??
        PROFILES[0],
      setActiveProfileId,
      selectedProblem,
      openProblem,
      closeProblem,
      authConfigured,
      sessionEmail,
      sessionUserId,
      dataStatus,
      dataError,
      loadArchive,
      requestSignInOtp,
      requestSignUpOtp,
      verifyOtp,
      signOut,
    }),
    [
      activeProfileId,
      archives,
      authConfigured,
      closeProblem,
      dataError,
      dataStatus,
      loadArchive,
      openProblem,
      problems,
      requestSignInOtp,
      requestSignUpOtp,
      selectedProblem,
      sessionEmail,
      sessionUserId,
      setActiveProfileId,
      signOut,
      verifyOtp,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }
  return context;
}
