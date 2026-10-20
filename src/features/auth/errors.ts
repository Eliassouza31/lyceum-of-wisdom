/** Turns Supabase Auth errors into messages that are safe and clear for end users. */
export function authErrorMessage(error: {
  code?: string;
  message: string;
  status?: number;
}): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please confirm your email address first. Check your inbox for the link.";
    case "weak_password":
      return "That password is too weak. Use at least 8 characters with letters and numbers.";
    case "same_password":
      return "Your new password must be different from the old one.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "signup_disabled":
      return "Sign-ups are currently closed.";
    case "reauthentication_needed":
    case "session_not_found":
    case "session_expired":
      return "Your session has expired. Please request a new password reset link.";
  }
  if (error.status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return "Something went wrong. Please try again.";
}
