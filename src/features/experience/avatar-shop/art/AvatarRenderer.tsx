import type { CSSProperties } from "react";
import { avatars, type AvatarId } from "../avatars";
import { avatarCollection, isCollectionCode } from "../avatar-collection";
import { isFashionCode } from "../avatar-fashion";
import { cosmeticSlot, splitCosmetic, type CosmeticCode, type CosmeticSlot, type EquippedCosmetic } from "../store";
import { BareLegs, BodyArt, DenimArt, HairArt } from "./AvatarBaseArt";
import { CosmeticArt, hasKidsDesign } from "./CosmeticArt";

interface AvatarProps {
  skinId: AvatarId;
  cosmetics?: readonly EquippedCosmetic[];
  size?: number;
  className?: string;
}

const placement: Record<CosmeticSlot, [number, number, number, number]> = {
  legs: [0, 0, 32, 64], feet: [0, 0, 32, 64],
  scene: [0, 30, 32, 34], body: [6, 23, 20, 25], hair: [5, 0, 23, 19],
  beard: [8, 16, 17, 13], neck: [9, 24, 14, 13], face: [8, 8, 19, 16],
  head: [4, 0, 24, 17], tool: [19, 24, 13, 18], effect: [0, 11, 32, 32],
};

const fittedAccessories: Partial<Record<CosmeticCode, [number, number, number, number]>> = {
  maquina_ouro: [21, 27, 11, 16],
  navalha_flamejante: [21, 25, 11, 17],
  coroa_barber: [6, 0, 21, 12],
  avental_lendario: [7, 23, 18, 22],
  cabelo_neon: [5, 1, 23, 17],
  tesoura_diamante: [21, 26, 11, 16],
  chapeu_supremo: [5, 0, 24, 14],
  tesoura_prisma: [21, 25, 11, 17],
  chapeu_fundador: [5, 0, 24, 14],
  avental_estreia: [7, 23, 18, 22],
};

function Accessory({ code, shirtNumber }: { code: CosmeticCode; shirtNumber?: number }) {
  if (isFashionCode(code) && !hasKidsDesign(code)) return <g data-cosmetic={code}><CosmeticArt code={code} shirtNumber={shirtNumber} mounted /></g>;
  if (!isCollectionCode(code)) return <CosmeticArt code={code} />;
  const item = avatarCollection[code];
  const [x, y, width, height] = fittedAccessories[code] ?? placement[item.slot];
  return (
    <svg x={x} y={y} width={width} height={height} viewBox="0 0 24 24" preserveAspectRatio="none"
      data-cosmetic={code} data-rarity={item.rarity}>
      <CosmeticArt code={code} mounted />
    </svg>
  );
}

export function AvatarRenderer({ skinId, cosmetics = [], size = 64, className }: AvatarProps) {
  const skin = avatars.find(({ id }) => id === skinId) ?? avatars[0];
  const style = { "--avatar-size": `${size}px`, "--avatar-backdrop": skin.backdrop } as CSSProperties;
  const accessories = cosmetics.map(splitCosmetic);
  const outfit = (slot: CosmeticSlot) => accessories.filter(({ code }) => cosmeticSlot(code) === slot)
    .map(item => <Accessory key={item.code} {...item} />);

  const fashionTop = accessories.find(({ code }) => isFashionCode(code) && cosmeticSlot(code) === "body");
  const dress = fashionTop?.code.startsWith("vestido_");
  const shorts = dress ? [] : outfit("legs");
  const shoes = outfit("feet");
  const denim = <DenimArt />;
  const lower = (
    <>
      {dress || shorts.length ? <>
        <BareLegs skinId={skin.id} seated={false} />
        {!shoes.length && <svg y="58" width="32" height="6" viewBox="0 58 32 6" overflow="hidden">{denim}</svg>}
        {shorts}
      </> : denim}
      {shoes}
    </>
  );
  const hair = outfit("hair");
  const beard = outfit("beard");
  const upper = (
    <g className="layer layer-avatar-upper">
      <BodyArt skinId={skin.id} showShirt={!fashionTop} />
      {outfit("body")}
      {hair.length ? hair : <HairArt skinId={skin.id} />}
      {beard}
      {outfit("neck")}
      {outfit("face")}
      {outfit("head")}
    </g>
  );

  return (
    <span className={`pixel-avatar${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      <svg className="pixel-avatar-art" viewBox="0 0 32 64" shapeRendering="crispEdges" focusable="false">
        {outfit("scene")}
        {outfit("effect")}
        {lower}
        {upper}
        {outfit("tool")}
      </svg>
    </span>
  );
}
