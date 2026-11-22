const colors: Record<string, string> = { violet: "#ab87ed", mint: "#77dac5", peach: "#ffb789" };

export function PixelAvatar({ palette, accessory }: { palette: string; accessory: string }) {
  const petal = colors[palette] ?? colors.violet;
  return (
    <div role="img" aria-label="Avatar de flor em um jardim em pixel art" className="relative grid aspect-[5/3] w-full max-w-sm place-items-center overflow-hidden rounded-2xl bg-[#352659]">
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/4 bg-[#2d6c60]" />
      <span aria-hidden="true" className="absolute top-5 right-6 text-[#f9dfaa]">{accessory === "star" ? "✦" : accessory === "butterfly" ? "🦋" : ""}</span>
      <span aria-hidden="true" className="absolute bottom-5 left-6 h-4 w-4 bg-[#83bfa7]" />
      <span aria-hidden="true" className="absolute bottom-9 right-9 h-3 w-3 bg-[#83bfa7]" />
      <div aria-hidden="true" className="relative grid grid-cols-5">
        {accessory === "crown" && <span className="absolute inset-x-0 -top-6 text-center">👑</span>}
        {[
          "01110",
          "12121",
          "11211",
          "01110",
          "00300",
          accessory === "leaf" ? "03330" : "00300",
          "00300",
        ].join("").split("").map((cell, index) => (
          <span key={index} className="size-3 sm:size-4" style={{ background: cell === "1" ? petal : cell === "2" ? "#fff4db" : cell === "3" ? "#78dab9" : "transparent" }} />
        ))}
      </div>
    </div>
  );
}
