export type Cents = number; // always an integer
export type Locale = "es" | "en";
export type Role = "owner" | "manager" | "server" | "kitchen";

export interface Ctx {
  restaurantId: string;
  actorUserId?: string;
  locale: Locale;
}

/** Thrown by stub implementations. The UI catches it and shows a calm "Disponible pronto" state. */
export class ConnectorNotImplementedError extends Error {
  constructor(
    public connector: string,
    public implementation: string,
  ) {
    super(`${connector}:${implementation} is not implemented yet`);
    this.name = "ConnectorNotImplementedError";
  }
}

export function isNotImplemented(error: unknown): error is ConnectorNotImplementedError {
  return error instanceof ConnectorNotImplementedError;
}

/** Reads an implementation name from the environment and rejects unknown values at startup. */
export function pickImplementation<const T extends string>(
  envVar: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = process.env[envVar] ?? fallback;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${envVar}=${value} is not one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Mock implementations exist only for local demos. */
export function mocksAllowed(): boolean {
  return process.env.MEZZA_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
}
