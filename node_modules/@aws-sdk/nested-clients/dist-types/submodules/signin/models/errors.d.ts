import type { ExceptionOptionType as __ExceptionOptionType } from "@smithy/core/client";
import type { OAuth2ErrorCode } from "./enums";
import { SigninServiceException as __BaseException } from "./SigninServiceException";
/**
 * You do not have sufficient access to perform this action.
 * @public
 */
export declare class AccessDeniedException extends __BaseException {
    static readonly shapeId: string;
    readonly name: "AccessDeniedException";
    readonly $fault: "client";
    /**
     * One of TOKEN_EXPIRED, AUTHCODE_EXPIRED, USER_CREDENTIALS_CHANGED, or INSUFFICIENT_PERMISSIONS.
     * @public
     */
    error: OAuth2ErrorCode | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<AccessDeniedException, __BaseException>);
}
/**
 * The request failed because of an internal server error.
 * @public
 */
export declare class InternalServerException extends __BaseException {
    static readonly shapeId: string;
    readonly name: "InternalServerException";
    readonly $fault: "server";
    /**
     * Will be server_error.
     * @public
     */
    error: OAuth2ErrorCode | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<InternalServerException, __BaseException>);
}
/**
 * The request failed because you exceeded the request rate limit for this operation.
 * @public
 */
export declare class TooManyRequestsError extends __BaseException {
    static readonly shapeId: string;
    readonly name: "TooManyRequestsError";
    readonly $fault: "client";
    /**
     * Will be rate_exceeded.
     * @public
     */
    error: OAuth2ErrorCode | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<TooManyRequestsError, __BaseException>);
}
/**
 * The request failed because it contains a malformed, missing, or invalid parameter.
 * @public
 */
export declare class ValidationException extends __BaseException {
    static readonly shapeId: string;
    readonly name: "ValidationException";
    readonly $fault: "client";
    /**
     * The specific code depends on which validation failed.
     * @public
     */
    error: OAuth2ErrorCode | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ValidationException, __BaseException>);
}
