import { avatarCollection, isCollectionCode, type CollectionCode } from "./avatar-collection";

const legacySlots = {
  snapback: "head", boina: "head", aviador: "face", avental: "body",
  jaqueta: "body", navalha: "tool", bandana: "head",
} as const;

export type CosmeticCode = keyof typeof legacySlots | CollectionCode;
export type EquippedCosmetic = CosmeticCode | `camisa_river:${number}`;
export const customizableShirt = "camisa_river";
export const defaultShirtNumber = 10;

export type CosmeticSlot = "head" | "body" | "legs" | "feet" | "face" | "tool" | "hair" | "beard" | "neck" | "scene" | "effect";
export type Rarity = "COMUM" | "RARO" | "LENDARIO" | "EXCLUSIVO";

export type CosmeticProduct = {
  id: string;
  nome: string;
  preco_pontos: number;
  cosmetic_code: CosmeticCode;
  cosmetic_slot: CosmeticSlot;
  rarity: Rarity;
};

export function isCosmeticCode(value: unknown): value is CosmeticCode {
  return isCollectionCode(value) || (typeof value === "string" && Object.hasOwn(legacySlots, value));
}

export function isShirtNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99;
}

export function splitCosmetic(cosmetic: EquippedCosmetic): { code: CosmeticCode; shirtNumber?: number } {
  if (isCosmeticCode(cosmetic)) return { code: cosmetic };
  const number = Number(cosmetic.slice(customizableShirt.length + 1));
  return { code: customizableShirt, shirtNumber: isShirtNumber(number) ? number : defaultShirtNumber };
}

export function cosmeticSlot(code: CosmeticCode): CosmeticSlot {
  return isCollectionCode(code) ? avatarCollection[code].slot : legacySlots[code];
}

export const demoCatalog: CosmeticProduct[] = (Object.keys(avatarCollection) as CollectionCode[]).map(code => {
  const item = avatarCollection[code];
  return {
    id: code,
    cosmetic_code: code,
    nome: item.name,
    cosmetic_slot: item.slot,
    rarity: item.rarity,
    preco_pontos: Math.ceil(item.price / 20),
  };
});
