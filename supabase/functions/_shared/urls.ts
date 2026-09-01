const BLOCKED_NAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.aws.internal",
  "instance-data",
]);

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const values = parts.map(Number);
  return values.every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 255,
  )
    ? values
    : null;
}

function parseIpv6(host: string): bigint | null {
  const normalized = host.toLowerCase().split("%", 1)[0];
  if (!normalized.includes(":")) return null;

  let source = normalized;
  const ipv4Tail = source.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (ipv4Tail) {
    const ipv4 = parseIpv4(ipv4Tail);
    if (!ipv4) return null;
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    source = `${source.slice(0, -ipv4Tail.length)}${high}:${low}`;
  }

  if ((source.match(/::/g) ?? []).length > 1) return null;
  const [leftRaw, rightRaw] = source.split("::", 2);
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  const omitted = source.includes("::") ? 8 - left.length - right.length : 0;
  if (omitted < 0 || (!source.includes("::") && left.length !== 8)) return null;

  const groups = [...left, ...Array(omitted).fill("0"), ...right];
  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))
  ) {
    return null;
  }

  return groups.reduce(
    (value, group) => (value << 16n) | BigInt(`0x${group}`),
    0n,
  );
}

export function isPrivateAddress(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    BLOCKED_NAMES.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  )
    return true;

  const ip = parseIpv4(host);
  if (ip) {
    const [a, b] = ip;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (host.includes(":")) {
    const value = parseIpv6(host);
    if (value === null || value === 0n || value === 1n) return true;

    // Only global unicast (2000::/3) is eligible. This fails closed for
    // loopback, IPv4-mapped/compatible, ULA, link-local and multicast ranges.
    if (value >> 125n !== 1n) return true;

    // Transition/documentation ranges can encapsulate another address or are
    // intentionally non-routable, so they are not valid scraping targets.
    const top32 = value >> 96n;
    if (top32 === 0x20010000n || top32 === 0x20010db8n) return true;
    if (value >> 112n === 0x2002n) return true;
  }
  return false;
}

export async function validatePublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_protocol");
  }
  if (url.username || url.password)
    throw new Error("url_credentials_not_allowed");
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("port_not_allowed");
  if (isPrivateAddress(url.hostname))
    throw new Error("private_address_blocked");

  if (!parseIpv4(url.hostname) && !url.hostname.includes(":")) {
    let dnsTimeout: number | undefined;
    try {
      const addresses = await Promise.race([
        Promise.all([
          Deno.resolveDns(url.hostname, "A").catch(() => [] as string[]),
          Deno.resolveDns(url.hostname, "AAAA").catch(() => [] as string[]),
        ]),
        new Promise<never>((_, reject) => {
          dnsTimeout = setTimeout(
            () => reject(new Error("dns_resolution_failed")),
            3_000,
          );
        }),
      ]);
      const resolved = addresses.flat();
      if (resolved.length === 0) throw new Error("dns_resolution_failed");
      if (resolved.some(isPrivateAddress))
        throw new Error("private_address_blocked");
    } catch (error) {
      if (error instanceof Error && error.message === "private_address_blocked")
        throw error;
      throw new Error("dns_resolution_failed");
    } finally {
      if (dnsTimeout !== undefined) clearTimeout(dnsTimeout);
    }
  }
  url.hash = "";
  return url;
}

export async function fetchPublicResource(
  rawUrl: string,
  options: {
    accept: string;
    maxBytes: number;
    timeoutMs?: number;
    maxRedirects?: number;
  },
): Promise<{ response: Response; bytes: Uint8Array; finalUrl: URL }> {
  let url = await validatePublicUrl(rawUrl);
  const maxRedirects = options.maxRedirects ?? 4;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 15_000,
    );
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: options.accept,
          "User-Agent": "BrieFlowBot/3.0 (+https://brieflow.app)",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");
        if (!location || redirects === maxRedirects)
          throw new Error("redirect_not_allowed");
        url = await validatePublicUrl(new URL(location, url).toString());
        continue;
      }

      const declaredLength = Number(
        response.headers.get("Content-Length") ?? 0,
      );
      if (declaredLength > options.maxBytes)
        throw new Error("resource_too_large");
      if (!response.body)
        return { response, bytes: new Uint8Array(), finalUrl: url };

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > options.maxBytes) {
          await reader.cancel();
          throw new Error("resource_too_large");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { response, bytes, finalUrl: url };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("redirect_not_allowed");
}
