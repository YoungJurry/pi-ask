export declare const OAuth2ErrorCode: {
  readonly AUTHCODE_EXPIRED: "AUTHCODE_EXPIRED";
  readonly CONFLICT: "CONFLICT";
  readonly INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
  readonly INVALID_REQUEST: "INVALID_REQUEST";
  readonly OAUTH_INVALID_GRANT: "invalid_grant";
  readonly OAUTH_INVALID_REQUEST: "invalid_request";
  readonly OAUTH_INVALID_SCOPE: "invalid_scope";
  readonly OAUTH_INVALID_TARGET: "invalid_target";
  readonly OAUTH_RATE_EXCEEDED: "rate_exceeded";
  readonly OAUTH_SERVICE_UNAVAILABLE: "service_unavailable";
  readonly OAUTH_UNSUPPORTED_GRANT_TYPE: "unsupported_grant_type";
  readonly RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND";
  readonly SERVER_ERROR: "server_error";
  readonly SERVICE_QUOTA_EXCEEDED: "SERVICE_QUOTA_EXCEEDED";
  readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
  readonly USER_CREDENTIALS_CHANGED: "USER_CREDENTIALS_CHANGED";
};
export type OAuth2ErrorCode = (typeof OAuth2ErrorCode)[keyof typeof OAuth2ErrorCode];
