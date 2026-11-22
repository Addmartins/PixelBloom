export const moods = ["happy", "calm", "sad", "angry", "worried", "tired"] as const;

export const moodLabels = {
  happy: "Feliz",
  calm: "Tranquilo",
  sad: "Triste",
  angry: "Com raiva",
  worried: "Preocupado",
  tired: "Cansado",
};

export const games = [
  {
    id: "patterns", title: "Trilha dos padrões",
    questions: [
      { prompt: "Círculo, triângulo, círculo… qual forma vem depois?", options: [["square", "Quadrado"], ["triangle", "Triângulo"], ["circle", "Círculo"]] },
      { prompt: "Azul, amarelo, azul, amarelo… qual cor vem depois?", options: [["green", "Verde"], ["blue", "Azul"], ["yellow", "Amarelo"]] },
      { prompt: "Uma estrela, duas estrelas, uma estrela… quantas vêm depois?", options: [["two", "Duas"], ["one", "Uma"], ["three", "Três"]] },
    ],
  },
  {
    id: "words", title: "Caça às pistas",
    questions: [
      { prompt: "Quando cai do céu, o guarda-chuva ajuda. O que é?", options: [["wind", "Vento"], ["rain", "Chuva"], ["sun", "Sol"]] },
      { prompt: "Tem páginas e pode contar uma história. O que é?", options: [["book", "Livro"], ["chair", "Cadeira"], ["ball", "Bola"]] },
      { prompt: "Tem penas e pode cantar pela manhã. Quem é?", options: [["fish", "Peixe"], ["cat", "Gato"], ["bird", "Pássaro"]] },
    ],
  },
] as const;
