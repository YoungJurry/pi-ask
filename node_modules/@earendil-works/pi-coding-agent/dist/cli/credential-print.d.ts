import type { ModelRuntime } from "../core/model-runtime.ts";
import type { Args } from "./args.ts";
export type CredentialPrintKind = "api_key" | "bearer_token";
export interface CredentialPrintCommand {
    kind: CredentialPrintKind;
    args: string[];
    minExpiryMs?: number;
}
export declare class CredentialPrintError extends Error {
}
export declare function isCredentialPrintHelp(args: string[]): boolean;
export declare function printCredentialPrintHelp(): void;
/** Parse the small, extensible `pi auth` command surface before normal startup. */
export declare function parseCredentialPrintCommand(args: string[]): CredentialPrintCommand | undefined;
export declare function validateCredentialPrintArgs(args: Args): void;
/**
 * Resolve one request credential for a specific provider/model pair.
 *
 * This intentionally calls ModelRuntime.getAuth(), which refreshes and persists
 * OAuth credentials with less than five minutes remaining through the normal request-auth path.
 */
export declare function resolveCredentialForPrint(args: Args, modelRuntime: ModelRuntime, kind: CredentialPrintKind, minExpiryMs?: number): Promise<string>;
//# sourceMappingURL=credential-print.d.ts.map