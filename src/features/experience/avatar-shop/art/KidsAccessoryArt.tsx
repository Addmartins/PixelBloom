import type { CollectionCode } from "../avatar-collection";

const designs = {
  pencil: "M3 18L16 5L20 9L7 22H3Z M17 4L19 2L23 6L21 8Z",
  book: "M3 3H20V21H3Z M7 1H9V23H7Z M11 8H17V10H11Z M11 12H17V14H11Z",
  brush: "M10 11L18 3L21 6L13 14Z M11 12L14 15L11 21H4V17L7 13Z",
  watering: "M5 9H17V19H5Z M16 6H21V14H18V9H16Z M2 5H5L9 11L6 14Z M7 6H13V9H7Z",
  pinwheel: "M11 11H13V22H11Z M12 12L4 11L4 4L12 7Z M12 12L14 4L21 4L18 12Z M12 12L21 14L21 21L14 18Z",
  paint: "M5 7H19L18 21H6Z M4 4H20V8H4Z M8 12H16V16H8Z",
  dots: "M2 11H5V14H2Z M6 14H9V17H6Z M15 14H18V17H15Z M19 11H22V14H19Z",
  heart: "M6 9H10V11H14V9H18V14L12 20L6 14Z",
  fox: "M2 7L7 10L12 15L17 10L22 7V14L12 20L2 14Z",
  rainbow: "M2 17V12L6 8H18L22 12V17H19V13L17 11H7L5 13V17Z M8 17V14H16V17H13V16H11V17Z",
  lantern: "M8 2H16V6H13V3H11V6H8Z M5 6H19V21H5Z M8 9H16V18H8Z",
  wand: "M4 20L15 9L17 11L6 22Z M17 2L19 5L23 6L20 8V12L17 10L13 12L14 8L11 6L15 5Z",
  magnifier: "M8 3H16L20 7V14L16 18H9L5 14V7Z M9 6L8 8V13L10 15H15L17 13V8L15 6Z M6 15L9 18L5 22L2 19Z",
  necklace: "M2 4H4L9 11H15L20 4H22L17 13H7Z M12 11H17V15L12 21H8V17Z",
  crystal: "M5 8L11 2H16L21 8V15L15 22H10L4 16Z M11 5L8 10L9 16L13 19L17 14V8L15 5Z",
  garden: "M2 18H22V23H2Z M5 11H9V15H7V21H5Z M3 8H8V12H3Z M13 6H19V11H13Z M15 10H17V21H15Z M19 12H23V16H21V21H19Z",
  sparkles: "M5 3L6 6L9 7L6 8L5 11L4 8L1 7L4 6Z M18 4L20 7L23 8L20 9L18 12L17 9L14 8L17 7Z M7 15L8 18L11 19L8 20L7 23L6 20L3 19L6 18Z M18 16H21V19H18Z",
  moon: "M4 3H8V5H16V3H20L23 8L20 13L18 11V22H6V11L4 13L1 8Z M13 9L10 11V16L13 18H16V16H14L12 14V11Z",
} as const;

export const kidsDesigns = {
  pente_preto: "pencil", tesoura_simples: "book", navalha_tradicional: "brush", maquina_basica: "watering",
  escova_cabelo: "pinwheel", creme_barbear: "paint", bigode_fino: "dots", barba_curta: "heart",
  maquina_dourada: "lantern", tesoura: "book", navalha_personalizada: "wand", barba_lenhador: "fox",
  escova_madeira: "magnifier", colar_navalha: "necklace", maquina_ouro: "watering", navalha_flamejante: "wand",
  barba_viking: "rainbow", tesoura_diamante: "crystal", cadeira_barbear: "garden", aura_laminas: "sparkles",
  tesoura_prisma: "crystal", trono_inauguracao: "garden", aura_letreiro: "sparkles", camiseta_batman: "moon",
} satisfies Partial<Record<CollectionCode, keyof typeof designs>>;

export function KidsAccessoryArt({ design, color, light }: {
  design: keyof typeof designs;
  color: string;
  light: string;
}) {
  return <path d={designs[design]} fillRule="evenodd" fill={light} stroke={color} strokeWidth=".65" />;
}
