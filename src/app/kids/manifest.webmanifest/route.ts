import manifest from "../../manifest";

export function GET() {
  return Response.json({
    ...manifest(),
    id: "/kids",
    name: "PixelBloom Kids",
    short_name: "Bloom Kids",
    description: "Jogos educativos, emoções e avatares.",
    start_url: "/kids",
    scope: "/kids",
  }, { headers: { "Content-Type": "application/manifest+json" } });
}
