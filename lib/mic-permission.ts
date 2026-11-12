export type MicPermission = "prompt" | "granted" | "denied" | "unsupported";

/** The round meter shows the word Start until the microphone is actually allowed. */
export function meterShowsStart(permission: MicPermission): boolean {
  return permission !== "granted";
}

export function permissionFromQuery(state: string | null | undefined): MicPermission {
  if (state === "granted" || state === "denied" || state === "prompt") return state;
  return "prompt";
}

export function permissionFromCaptureError(error: unknown): "denied" | "unsupported" {
  const name = typeof error === "object" && error && "name" in error ? String((error as { name?: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  return "unsupported";
}

/** The opening screen stays up until capture succeeds. */
export function dismissStartAfterCapture(granted: boolean): boolean {
  return granted;
}

export function micBlockMessage(permission: MicPermission): string | null {
  if (permission === "denied") {
    return "The microphone is blocked. Allow it for this site in the browser settings, then press Start.";
  }
  if (permission === "unsupported") {
    return "This browser has no microphone to use. Chrome on a computer can take the order.";
  }
  return null;
}
