/**
 * Hostname form used for denylist matching: lowercase, no bracketed IPv6 wrapper, no trailing FQDN dot.
 */
export function canonicalizeHostnameForDenylist(host: string): string {
    let h = host.trim().toLowerCase();
    if (h.startsWith('[') && h.endsWith(']')) {
        h = h.slice(1, -1);
    }
    while (h.endsWith('.')) {
        h = h.slice(0, -1);
    }
    return h;
}

/**
 * Normalize a denylist entry to a lowercase hostname for comparison.
 * Accepts bare hostnames/IPs or full URLs (uses URL.hostname when `://` is present).
 */
export function normalizeDenylistHost(entry: string): string {
    const trimmed = entry.trim();
    if (!trimmed) {
        return '';
    }
    let host: string;
    if (trimmed.includes('://')) {
        try {
            host = new URL(trimmed).hostname;
        } catch {
            host = trimmed;
        }
    } else {
        host = trimmed;
    }
    return canonicalizeHostnameForDenylist(host);
}

export function normalizeDenylist(denylist: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const e of denylist) {
        const h = normalizeDenylistHost(e);
        if (h && !seen.has(h)) {
            seen.add(h);
            out.push(h);
        }
    }
    return out;
}

export function isBaseUrlOverrideDenied(overrideUrl: string, denylist: string[]): boolean {
    let hostname: string;
    try {
        hostname = canonicalizeHostnameForDenylist(new URL(overrideUrl).hostname);
    } catch {
        return false;
    }
    return denylist.includes(hostname);
}
