import { hasOwn, writeKey } from "@smithy/core/serde";
import { ALWAYS_UNSIGNABLE_HEADERS, PROXY_HEADER_PATTERN, SEC_HEADER_PATTERN } from "./constants";
export const getCanonicalHeaders = ({ headers }, unsignableHeaders, signableHeaders) => {
    const canonical = {};
    for (const headerName of Object.keys(headers).sort()) {
        if (headers[headerName] == undefined) {
            continue;
        }
        const canonicalHeaderName = headerName.toLowerCase();
        if (hasOwn(ALWAYS_UNSIGNABLE_HEADERS, canonicalHeaderName) ||
            unsignableHeaders?.has(canonicalHeaderName) ||
            PROXY_HEADER_PATTERN.test(canonicalHeaderName) ||
            SEC_HEADER_PATTERN.test(canonicalHeaderName)) {
            if (!signableHeaders || (signableHeaders && !signableHeaders.has(canonicalHeaderName))) {
                continue;
            }
        }
        if (canonicalHeaderName === "__proto__") {
            writeKey(canonical);
        }
        canonical[canonicalHeaderName] = headers[headerName]
            .replace(/[\r\n]/g, " ")
            .replace(/[ \t]+/g, " ")
            .replace(/^ | $/g, "");
    }
    return canonical;
};
