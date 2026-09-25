import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPlankaRequest = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule("../../common/utils.js", () => ({ plankaRequest: mockPlankaRequest, sanitizeId: (id: string) => id, getUserIdByEmail: jest.fn(), getUserIdByUsername: jest.fn() }));
const { getBoardSummary } = await import("../../tools/board-summary.js");
const { getBoard } = await import("../../operations/boards.js");

const board = { id: "board-1", projectId: "project-1", name: "Board", position: 1, createdAt: null, updatedAt: null };
const list = (id: string, name: string) => ({ id, boardId: "board-1", name, position: 1, createdAt: null, updatedAt: null });
const card = (id: string, listId: string) => ({ id, listId, name: id, type: "project", description: null, position: 1, dueDate: null, createdAt: null, updatedAt: null });
const label = (id: string, name: string) => ({ id, boardId: "board-1", name, color: "berry-red", position: 1, createdAt: null, updatedAt: null });
const assignment = (cardId: string, labelId: string) => ({ id: `${cardId}-${labelId}`, cardId, labelId, createdAt: null, updatedAt: null });
const snapshot = { item: board, included: {
  lists: [{ ...list("backlog", "Backlog"), customViewSetting: "kept" }, list("done", "Done")],
  cards: [card("a", "backlog"), card("b", "backlog"), card("c", "done")],
  labels: [label("urgent", "Urgent"), label("bug", "Bug"), label("unused", "Unused")],
  cardLabels: [assignment("a", "urgent"), assignment("a", "bug"), assignment("b", "bug"), assignment("b", "missing")],
} };
const calls = () => mockPlankaRequest.mock.calls.map((call: any[]) => call[0]);
beforeEach(() => { mockPlankaRequest.mockReset(); });

describe("board snapshot summary", () => {
  it("uses one board GET and maps assignments into grouped cards and urgent/bug stats", async () => {
    mockPlankaRequest.mockImplementation(async (path: string) => {
      if (path === "/api/boards/board-1") return snapshot;
      throw new Error(`Unexpected path ${path}`);
    });
    const result = await getBoardSummary({ boardId: "board-1", includeTaskDetails: false, includeComments: false });
    expect(calls()).toEqual(["/api/boards/board-1"]);
    expect(result.board).toEqual(board);
    expect(result.labels).toEqual(snapshot.included.labels);
    expect(result.lists[0]).toMatchObject({ customViewSetting: "kept" });
    expect(result.lists.map(({ cards, cardCount }: any) => ({ cardCount, cards: cards.map(({ id, labelIds, labels }: any) => ({ id, labelIds, labels })) }))).toEqual([
      { cardCount: 2, cards: [
        { id: "a", labelIds: ["urgent", "bug"], labels: [{ id: "urgent", name: "Urgent", color: "berry-red" }, { id: "bug", name: "Bug", color: "berry-red" }] },
        { id: "b", labelIds: ["bug", "missing"], labels: [{ id: "bug", name: "Bug", color: "berry-red" }] },
      ] },
      { cardCount: 1, cards: [{ id: "c", labelIds: [], labels: [] }] },
    ]);
    expect(result.stats).toMatchObject({ totalCards: 3, backlogCount: 2, doneCount: 1, urgentCount: 1, bugCount: 2 });
  });

  it("preserves opt-in task and comment details", async () => {
    mockPlankaRequest.mockImplementation(async (path: string) => {
      if (path === "/api/boards/board-1") return { item: board, included: { lists: [list("backlog", "Backlog")], cards: [card("a", "backlog")], labels: [], cardLabels: [] } };
      if (path === "/api/cards/a") return { item: card("a", "backlog"), included: { taskLists: [] } };
      if (path === "/api/cards/a/comments") return { items: [] };
      throw new Error(`Unexpected path ${path}`);
    });
    const result = await getBoardSummary({ boardId: "board-1", includeTaskDetails: true, includeComments: true });
    expect(calls()).toEqual(["/api/boards/board-1", "/api/cards/a", "/api/cards/a/comments"]);
    expect(result.lists[0].cards[0]).toMatchObject({ tasks: { items: [], total: 0, completed: 0, completionPercentage: 0 }, comments: [], labelIds: [], labels: [] });
  });

  it("keeps getBoard's item-only return contract", async () => {
    mockPlankaRequest.mockResolvedValue(snapshot);
    expect(await getBoard("board-1")).toEqual(board);
  });
});
