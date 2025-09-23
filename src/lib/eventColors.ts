export const orderedEventKeys = [
  "OPENING",
  "RB1",
  "TERRACE1",
  "SOUPS",
  "COCKTAIL",
  "TERRACE2",
  "RB2",
  "TERRACE3",
  "PRIZES",
] as const;

const pastelBGs = [
  "#FFE4E6", // light rose/red
  "#FFEDD5", // light orange
  "#FEF3C7", // light yellow
  "#D1FAE5", // light green
  "#DBEAFE", // light blue
  "#EDE9FE", // light indigo/purple
  "#FCE7F3", // light pink/violet
];

export const eventColorMap: Record<string, string> = Object.fromEntries(
  (orderedEventKeys as readonly string[]).map((k, idx) => [k, pastelBGs[idx % pastelBGs.length]])
);

export const getEventColor = (key: string) => eventColorMap[key] ?? pastelBGs[0];
