import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signInWithOtp: vi.fn(),
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("./client", () => ({
  getSupabaseClient: () => ({ auth: mockAuth }),
}));

import {
  requestSignInOtp,
  requestSignUpOtp,
  verifyEmailOtp,
} from "./auth";

describe("supabase auth flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.signInWithPassword.mockResolvedValue({ error: null });
    mockAuth.signOut.mockResolvedValue({ error: null });
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    mockAuth.signUp.mockResolvedValue({ error: null });
    mockAuth.verifyOtp.mockResolvedValue({ error: null });
  });

  it("requires password check before sending sign-in OTP", async () => {
    await expect(requestSignInOtp("me@example.com", "secret123")).resolves.toEqual({
      success: true,
    });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "me@example.com",
      password: "secret123",
    });
    expect(mockAuth.signOut).toHaveBeenCalledOnce();
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: "me@example.com",
      options: { shouldCreateUser: false },
    });
  });

  it("returns a failure when password sign-in fails", async () => {
    const error = { message: "Invalid login credentials" };
    mockAuth.signInWithPassword.mockResolvedValue({ error });

    await expect(requestSignInOtp("me@example.com", "bad")).resolves.toEqual({
      success: false,
      error,
    });
    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("creates an account before OTP verification", async () => {
    await expect(requestSignUpOtp("new@example.com", "secret123")).resolves.toEqual({
      success: true,
    });
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "secret123",
    });
  });

  it("verifies OTP with the requested verification type", async () => {
    await expect(
      verifyEmailOtp("new@example.com", "123456", "signup"),
    ).resolves.toEqual({ success: true });
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: "new@example.com",
      token: "123456",
      type: "signup",
    });
  });
});
