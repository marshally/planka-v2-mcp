import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPlankaRequest = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule("../../common/utils.js", () => ({
  plankaRequest: mockPlankaRequest,
  sanitizeId: (id: string) => id,
}));
const { getCards, getCard, createCard, duplicateCard } = await import("../../operations/cards.js");

const card = (id: string, boardId?: string) => ({
  id, listId: "list-1", ...(boardId ? { boardId } : {}), name: id,
  type: "project", description: null, position: 1, dueDate: null,
  createdAt: null, updatedAt: null,
});
const label = (id: string, name: string) => ({ id, boardId: "board-1", name, color: "berry-red", position: 1, createdAt: null, updatedAt: null });
const assignment = (cardId: string, labelId: string) => ({ id: `${cardId}-${labelId}`, cardId, labelId, createdAt: null, updatedAt: null });
const calls = () => mockPlankaRequest.mock.calls.map((call: any[]) => call[0]);

beforeEach(() => { mockPlankaRequest.mockReset(); });

describe("read card labels", () => {
  it("maps each list card's assigned labels, dedupes assignments, and keeps dangling IDs", async () => {
    mockPlankaRequest.mockImplementation(async (path: string) => {
      if (path === "/api/lists/list-1/cards") return {
        items: [card("a", "board-1"), card("b", "board-1"), card("c", "board-1")],
        included: { cardLabels: [assignment("a", "urgent"), assignment("a", "urgent"), assignment("a", "missing"), assignment("b", "bug")] },
      };
      if (path === "/api/boards/board-1/labels") return { items: [label("urgent", "Urgent"), label("bug", "Bug"), label("unused", "Unused")] };
      throw new Error(`Unexpected path ${path}`);
    });
    const result = await getCards("list-1");
    expect(result.map(({ labelIds, labels }: any) => ({ labelIds, labels }))).toEqual([
      { labelIds: ["urgent", "missing"], labels: [{ id: "urgent", name: "Urgent", color: "berry-red" }] },
      { labelIds: ["bug"], labels: [{ id: "bug", name: "Bug", color: "berry-red" }] },
      { labelIds: [], labels: [] },
    ]);
    expect(calls()).toEqual(["/api/lists/list-1/cards", "/api/boards/board-1/labels"]);
  });

  it("resolves missing boardId through its list and retains IDs when label lookup fails", async () => {
    mockPlankaRequest.mockImplementation(async (path: string) => {
      if (path === "/api/cards/a") return { item: card("a"), included: { cardLabels: [assignment("a", "urgent")] } };
      if (path === "/api/lists/list-1") return { item: { id: "list-1", boardId: "board-1", name: "Todo", position: 1, createdAt: null, updatedAt: null } };
      if (path === "/api/boards/board-1/labels") throw new Error("lookup failed");
      throw new Error(`Unexpected path ${path}`);
    });
    const result = await getCard("a");
    expect(result).toMatchObject({ labelIds: ["urgent"], labels: [] });
    expect(calls()).toEqual(["/api/cards/a", "/api/lists/list-1", "/api/boards/board-1/labels"]);
  });

  it("does not require or invent label fields on write responses", async () => {
    mockPlankaRequest.mockResolvedValue({ item: card("created") });
    expect(await createCard({ listId: "list-1", name: "Created", type: "project" })).toEqual(card("created"));
  });

  it("does not fetch labels when duplicating a card", async () => {
    mockPlankaRequest.mockImplementation(async (path: string) => {
      if (path === "/api/cards/original") return { item: card("original", "board-1"), included: { cardLabels: [assignment("original", "urgent")] } };
      if (path === "/api/lists/list-1/cards") return { item: card("copy", "board-1") };
      throw new Error(`Unexpected path ${path}`);
    });
    expect(await duplicateCard("original")).toEqual(card("copy", "board-1"));
    expect(calls()).toEqual(["/api/cards/original", "/api/lists/list-1/cards"]);
  });
});
