const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function unbase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
export function randomSecret(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
export async function sha256(value: string): Promise<string> {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
/** AAD binds a credential to its owner and channel; copying ciphertext cannot swap accounts. */
export async function seal(
  value: string,
  keyText: string,
  binding: string,
): Promise<string> {
  const keyBytes = unbase64(keyText);
  if (keyBytes.length !== 32) throw new Error("encryption_not_configured");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(binding) },
    key,
    encoder.encode(value),
  );
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(cipher))}`;
}
export async function unseal(
  value: string,
  keyText: string,
  binding: string,
): Promise<string> {
  const [version, iv, cipher] = value.split(".");
  if (version !== "v1" || !iv || !cipher) throw new Error("invalid_credential");
  const key = await crypto.subtle.importKey(
    "raw",
    unbase64(keyText),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: unbase64(iv),
      additionalData: encoder.encode(binding),
    },
    key,
    unbase64(cipher),
  );
  return new TextDecoder().decode(plain);
}
