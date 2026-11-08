import type { CardWithLabels, PlankaCard, PlankaCardLabel, PlankaLabel } from "./types.js";

/** Add only assignments belonging to each card; unresolved IDs remain visible. */
export function withCardLabels(
  cards: PlankaCard[],
  assignments: PlankaCardLabel[],
  boardLabels: PlankaLabel[],
): CardWithLabels[] {
  const labelsById = new Map(boardLabels.map((label) => [label.id, label]));
  const idsByCard = new Map<string, Set<string>>();
  for (const { cardId, labelId } of assignments) {
    const ids = idsByCard.get(cardId) ?? new Set<string>();
    ids.add(labelId);
    idsByCard.set(cardId, ids);
  }
  return cards.map((card) => {
    const labelIds = [...(idsByCard.get(card.id) ?? [])];
    const labels = labelIds.flatMap((id) => {
      const label = labelsById.get(id);
      return label ? [{ id: label.id, name: label.name, color: label.color }] : [];
    });
    return { ...card, labelIds, labels };
  });
}
