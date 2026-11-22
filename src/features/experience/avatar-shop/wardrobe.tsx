"use client";

import { useState, useTransition } from "react";
import { AvatarRenderer } from "./art/AvatarRenderer";
import { CosmeticArt, cosmeticViewBox } from "./art/CosmeticArt";
import { changeShopItem } from "./actions";
import { demoCatalog, type CosmeticProduct, type CosmeticSlot, type Rarity } from "./store";
import "./wardrobe.css";

const categories: Record<CosmeticSlot, string> = {
  head: "Cabeça", body: "Roupas", legs: "Shorts e bermudas", feet: "Calçados", face: "Rosto",
  tool: "Acessórios de mão", hair: "Cabelo", beard: "Pintura facial", neck: "Colares", scene: "Cenários", effect: "Efeitos",
};
const rarities: Record<Rarity, string> = { COMUM: "Comum", RARO: "Raro", LENDARIO: "Lendário", EXCLUSIVO: "Exclusivo" };

type Ownership = { id: string; equipped: boolean };
type Operation = "buy" | "equip" | "unequip";
type LiveShop = { products: CosmeticProduct[]; balance: number; items: Ownership[]; slug: string; patientId: string };

export function AvatarWardrobe({ live }: { live?: LiveShop }) {
  const [demoBalance, setDemoBalance] = useState(40);
  const [demoItems, setDemoItems] = useState<Ownership[]>([]);
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [preview, setPreview] = useState<string>();
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const [pending, startTransition] = useTransition();
  const products = live?.products ?? demoCatalog;
  const balance = live?.balance ?? demoBalance;
  const owned = new Map((live?.items ?? demoItems).map(item => [item.id, item]));
  const previewed = products.find(product => product.id === preview);
  const equipped = products.filter(product => owned.get(product.id)?.equipped);
  const fitting = equipped.filter(product => product.cosmetic_slot !== previewed?.cosmetic_slot).map(product => product.cosmetic_code);
  if (previewed) fitting.push(previewed.cosmetic_code);

  const visible = products.filter(product => (category === "all" || product.cosmetic_slot === category) &&
    (filter === "all" || (filter === "wardrobe" ? owned.has(product.id) : product.rarity === filter)));

  function update(product: CosmeticProduct, operation: Operation) {
    setFeedback(undefined);
    if (operation === "buy" && (owned.has(product.id) || balance < product.preco_pontos)) return;
    startTransition(async () => {
      if (live) {
        try {
          const result = await changeShopItem(live.slug, live.patientId, product.id, operation);
          if (result.error) {
            setFeedback({ text: result.error, error: true });
            return;
          }
        } catch {
          setFeedback({ text: "Não foi possível atualizar a loja. Tente novamente.", error: true });
          return;
        }
      } else if (operation === "buy") {
        setDemoBalance(value => value - product.preco_pontos);
        setDemoItems(items => [...items, { id: product.id, equipped: false }]);
      } else {
        setDemoItems(items => items.map(item => {
          if (item.id === product.id) return { ...item, equipped: operation === "equip" };
          const current = products.find(candidate => candidate.id === item.id);
          return operation === "equip" && current?.cosmetic_slot === product.cosmetic_slot
            ? { ...item, equipped: false } : item;
        }));
      }
      setPreview(undefined);
      setFeedback({ text: operation === "buy" ? "Item resgatado!" : operation === "equip" ? "Item equipado!" : "Item removido do avatar." });
    });
  }

  return <section className="panel grid gap-5" id="loja-de-avatares" aria-labelledby="avatar-shop-title">
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="avatar-shop-title" className="text-2xl font-bold">Loja de avatares</h2>
      <p className="font-semibold text-primary">{balance} pontos</p>
    </header>
    <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-background p-4">
      <div role="img" aria-label={previewed ? `Avatar experimentando ${previewed.nome}` : "Seu avatar"}>
        <AvatarRenderer skinId="trancas" cosmetics={fitting} size={118} />
      </div>
      <div className="grid gap-2">
        <p className="font-semibold">{previewed ? previewed.nome : "Seu provador"}</p>
        {previewed ? <button className="button-secondary" onClick={() => setPreview(undefined)}>Limpar prévia</button>
          : <p className="text-muted">Experimente os itens antes de resgatar.</p>}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Mostrar<select className="field" value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="all">Todos</option><option value="wardrobe">Meu guarda-roupa</option>
        {Object.entries(rarities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Categoria<select className="field" value={category} onChange={event => setCategory(event.target.value)}>
        <option value="all">Todas</option>
        {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    <p className="text-sm text-muted">{visible.length} {visible.length === 1 ? "item" : "itens"}</p>
    {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map(product => {
        const item = owned.get(product.id);
        const operation = item ? item.equipped ? "unequip" : "equip" : "buy";
        return <li className="grid content-start gap-2 rounded-xl border border-border p-3" key={product.id}>
          <div className="flex items-center gap-3">
            <svg className="size-14 shrink-0 rounded-lg bg-background p-1" viewBox={cosmeticViewBox(product.cosmetic_code)}
              shapeRendering="crispEdges" aria-hidden="true"><CosmeticArt code={product.cosmetic_code} /></svg>
            <div><h3 className="font-semibold">{product.nome}</h3>
              <p className="text-sm text-muted">{rarities[product.rarity]} · {item ? item.equipped ? "Equipado" : "Adquirido" : `${product.preco_pontos} pontos`}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => setPreview(product.id)} aria-label={`Experimentar ${product.nome}`}>Experimentar</button>
            <button className="button" disabled={pending || (!item && balance < product.preco_pontos)}
              onClick={() => update(product, operation)}>{operation === "buy" ? "Resgatar" : operation === "equip" ? "Equipar" : "Remover"}</button>
          </div>
        </li>;
      })}
    </ul>
  </section>;
}
