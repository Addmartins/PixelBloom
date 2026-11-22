import { AudioLines, Shapes } from "lucide-react";
import { ActionForm } from "@/features/organizations/action-form";
import { finishGame, saveMood } from "./family-actions";
import { games, moodLabels, moods } from "./kids-content";

export function KidsPlay({ slug, patientId, moodEnabled }: { slug: string; patientId: string; moodEnabled: boolean }) {
  return (
    <>
      {moodEnabled && <section className="panel grid gap-3" aria-labelledby="kids-mood">
        <h2 id="kids-mood" className="text-xl font-semibold">Como você está hoje?</h2>
        <p>Escolha como se sente, se quiser. Seu responsável poderá ver sua escolha.</p>
        <ActionForm action={saveMood.bind(null, slug, patientId)} label="Guardar emoção">
          <label className="grid gap-1">Escolha uma emoção
            <select className="field" name="mood" defaultValue="" required>
              <option value="" disabled>Escolher</option>
              {moods.map(mood => <option key={mood} value={mood}>{moodLabels[mood]}</option>)}
            </select>
          </label>
        </ActionForm>
      </section>}
      <section className="grid gap-4" aria-labelledby="kids-games">
        <h2 id="kids-games" className="text-2xl font-bold">Jogos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {games.map(game => <section key={game.id} className="panel grid content-start gap-3">
            <h3 className="flex items-center gap-2 text-xl font-semibold text-primary">
              {game.id === "patterns" ? <Shapes aria-hidden="true" size={24} /> : <AudioLines aria-hidden="true" size={24} />}
              {game.title}
            </h3>
            <ActionForm action={finishGame.bind(null, slug, patientId, game.id)} label="Conferir respostas">
              {game.questions.map((question, index) => <fieldset className="grid gap-2" key={question.prompt}>
                <legend className="mb-2 font-medium">{question.prompt}</legend>
                <div className="flex flex-wrap gap-2">
                  {question.options.map(([value, label]) => <label key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 has-checked:border-primary has-checked:bg-background">
                    <input type="radio" name={`answer-${index}`} value={value} className="accent-primary" required />
                    {label}
                  </label>)}
                </div>
              </fieldset>)}
            </ActionForm>
          </section>)}
        </div>
      </section>
    </>
  );
}
