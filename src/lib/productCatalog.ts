import {
  applyPilotEvent,
  factRevision,
  startPilotRun,
  type PilotRun,
  type PilotCohort,
  type PilotEvent,
} from "./skuPilot.ts";
import { parsePrice, type CatalogProduct } from "./skuReview.ts";

export type ProductInput = Omit<
  CatalogProduct,
  "revision" | "factRevision" | "updatedAt" | "priorUnits" | "priorPrices"
>;
export type ProductForm = {
  sku: string;
  name: string;
  price: string;
  unit: string;
  source: string;
  imageUrl: string;
};

export function productInput(form: ProductForm): ProductInput {
  const sku = form.sku.trim().toUpperCase();
  const priceCents = parsePrice(form.price);
  if (
    !sku ||
    sku.length > 100 ||
    !form.name.trim() ||
    !form.unit.trim() ||
    !form.source.trim()
  )
    throw new Error("Preencha SKU, nome, preço, unidade e fonte.");
  if (priceCents === null)
    throw new Error("Informe um preço em reais, por exemplo 39,90.");
  const imageUrl = form.imageUrl.trim();
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error();
    } catch {
      throw new Error("Use um endereço HTTPS para a foto.");
    }
  }
  return {
    sku,
    name: form.name.trim(),
    priceCents,
    unit: form.unit.trim(),
    source: form.source.trim(),
    imageUrl: imageUrl || undefined,
  };
}

export function parseCatalogCsv(csv: string): ProductInput[] {
  const source = csv.replace(/^\uFEFF/, "");
  const delimiter = source.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("O CSV tem um campo com aspas sem fechamento.");
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  const headers = (rows.shift() ?? []).map((col) =>
    col.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""),
  );
  const required = ["sku", "nome", "preco", "unidade", "fonte"];
  if (!required.every((name) => headers.includes(name)))
    throw new Error(
      "O CSV precisa das colunas sku, nome, preco, unidade e fonte. A coluna foto é opcional.",
    );
  if (!rows.length) throw new Error("O CSV não contém produtos.");
  const seen = new Set<string>();
  return rows.map((values, index) => {
    const get = (key: string) => values[headers.indexOf(key)] || "";
    try {
      const product = productInput({
        sku: get("sku"),
        name: get("nome"),
        price: get("preco"),
        unit: get("unidade"),
        source: get("fonte"),
        imageUrl: get("foto"),
      });
      if (seen.has(product.sku))
        throw new Error(
          "Há mais de uma linha para " +
            product.sku +
            ". Escolha a oferta que deve valer para a campanha.",
        );
      seen.add(product.sku);
      return product;
    } catch (error) {
      throw new Error("Linha " + (index + 2) + ". " + (error as Error).message);
    }
  });
}

export function catalogOwner(userId?: string) {
  if (userId) return "user:" + userId;
  const key = "brieflow:sku-guest";
  let guest = sessionStorage.getItem(key);
  if (!guest) {
    guest = crypto.randomUUID();
    sessionStorage.setItem(key, guest);
  }
  return "guest:" + guest;
}

type StoredProduct = { owner: string; sku: string; value: CatalogProduct };
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (!connection) {
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("brieflow-product-catalog", 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("products")) {
          const products = request.result.createObjectStore("products", {
            keyPath: ["owner", "sku"],
          });
          products.createIndex("owner", "owner");
        }
        if (!request.result.objectStoreNames.contains("pilotRuns")) {
          const runs = request.result.createObjectStore("pilotRuns", {
            keyPath: ["owner", "sku", "revision"],
          });
          runs.createIndex("owner", "owner");
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
      request.onerror = () =>
        reject(new Error("Não foi possível abrir o catálogo neste navegador."));
    });
    connection = opening.catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  return connection;
}

async function read<T>(
  query: (store: IDBObjectStore) => IDBRequest<T>,
  name = "products",
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = query(db.transaction(name).objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function listProducts(owner: string): Promise<CatalogProduct[]> {
  const rows: StoredProduct[] = await read((store) =>
    store.index("owner").getAll(owner),
  );
  return rows.map((row) => row.value);
}
export async function getProduct(
  owner: string,
  sku: string,
): Promise<CatalogProduct | undefined> {
  const row: StoredProduct | undefined = await read((store) =>
    store.get([owner, sku]),
  );
  return row?.value;
}
export const catalogChangedEvent = "brieflow:sku-catalog-changed";
export const pilotChangedEvent = "brieflow:sku-pilot-changed";
function notifyChange(event: string, owner: string) {
  window.dispatchEvent(new Event(event));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(event);
    channel.postMessage(owner);
    channel.close();
  }
}

export function getPilotRun(
  owner: string,
  sku: string,
  revision: string,
): Promise<PilotRun | undefined> {
  return read((store) => store.get([owner, sku, revision]), "pilotRuns");
}

export async function listPilotRuns(owner: string): Promise<PilotRun[]> {
  const rows: PilotRun[] = await read(
    (store) => store.index("owner").getAll(owner),
    "pilotRuns",
  );
  return rows.sort(
    (a, b) => b.startedAt - a.startedAt || b.revision.localeCompare(a.revision),
  );
}

function changeRun(
  store: IDBObjectStore,
  owner: string,
  sku: string,
  revision: string,
  event: PilotEvent,
) {
  const request = store.get([owner, sku, revision]);
  request.onsuccess = () => {
    const run: PilotRun | undefined = request.result;
    if (!run) return;
    const next = applyPilotEvent(run, event);
    if (next !== run) store.put(next);
  };
}
export async function recordPilot(
  owner: string,
  sku: string,
  revision: string,
  event: PilotEvent,
) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pilotRuns", "readwrite");
    changeRun(tx.objectStore("pilotRuns"), owner, sku, revision, event);
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("Não foi possível salvar a medição."));
  });
  notifyChange(pilotChangedEvent, owner);
}
export interface CatalogWrite {
  input: ProductInput;
  expected: string | null;
}
export async function writeProducts(
  owner: string,
  updates: CatalogWrite[],
  onlyMissing = false,
  cohort?: PilotCohort,
) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["products", "pilotRuns"], "readwrite");
    const store = tx.objectStore("products");
    let conflict: Error | undefined;
    for (const { input, expected } of updates) {
      const lookup = store.get([owner, input.sku]);
      lookup.onsuccess = () => {
        const previous: StoredProduct | undefined = lookup.result;
        if (onlyMissing && previous) return;
        if ((previous?.value.revision ?? null) !== expected) {
          conflict = new Error(
            "O cadastro de " +
              input.sku +
              " mudou. Confira a versão atual e tente novamente.",
          );
          tx.abort();
          return;
        }
        const commercialChange = Boolean(
          previous &&
          (previous.value.priceCents !== input.priceCents ||
            previous.value.unit !== input.unit),
        );
        const revision = crypto.randomUUID();
        const value: CatalogProduct = {
          ...input,
          priorUnits: previous
            ? [
                ...new Set([
                  ...(previous.value.priorUnits ?? []),
                  previous.value.unit,
                ]),
              ]
            : [],
          priorPrices: previous
            ? [
                ...new Set([
                  ...(previous.value.priorPrices ?? []),
                  previous.value.priceCents,
                ]),
              ]
            : [],
          revision,
          factRevision:
            previous && !commercialChange
              ? factRevision(previous.value)
              : revision,
          updatedAt: new Date().toISOString(),
        };
        if (previous && commercialChange) {
          const runs = tx.objectStore("pilotRuns");
          const run = startPilotRun(
            owner,
            previous.value,
            value,
            cohort ?? { scope: "partial", campaigns: [] },
          );
          changeRun(runs, owner, input.sku, factRevision(previous.value), {
            type: "supersede",
            at: run.startedAt,
          });
          runs.add(run);
        }
        store.put({ owner, sku: input.sku, value } satisfies StoredProduct);
      };
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        conflict ??
          tx.error ??
          new Error("Não foi possível salvar o catálogo."),
      );
    tx.onerror = () => {
      /* onabort reports the final transaction outcome. */
    };
  });
  notifyChange(catalogChangedEvent, owner);
  notifyChange(pilotChangedEvent, owner);
}

export const sameProduct = (a: ProductInput, b: ProductInput) =>
  a.sku === b.sku &&
  a.name === b.name &&
  a.priceCents === b.priceCents &&
  a.unit === b.unit &&
  a.source === b.source &&
  (a.imageUrl || "") === (b.imageUrl || "");
