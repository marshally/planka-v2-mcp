import { describe, expect, it, jest } from "@jest/globals";

const mockPlankaRequest = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule("../../common/utils.js", () => ({
  plankaRequest: mockPlankaRequest,
  sanitizeId: (id: string) => id,
  getUserIdByEmail: jest.fn(),
  getUserIdByUsername: jest.fn(),
}));
const { performWorkflowAction } = await import("../../tools/workflow-actions.js");

const card = { id: "card-1", listId: "todo", boardId: "board-1", name: "Card", type: "project", description: null, position: 1, dueDate: null, createdAt: null, updatedAt: null };
const board = { id: "board-1", projectId: "project-1", name: "Board", position: 1, createdAt: null, updatedAt: null };
const comment = { id: "comment-1", cardId: "card-1", userId: null, text: "🚀 Started working on this card.", createdAt: null, updatedAt: null };

describe("workflow actions", () => {
  it("moves an assigned card without loading the label catalog", async () => {
    mockPlankaRequest.mockReset();
    mockPlankaRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/cards/card-1" && !options?.method) return {
        item: card,
        included: { cardLabels: [{ id: "assignment-1", cardId: "card-1", labelId: "bug", createdAt: null, updatedAt: null }] },
      };
      if (path === "/api/boards/board-1") return { item: board, included: { lists: [{ id: "progress", boardId: "board-1", name: "In Progress", position: 1, createdAt: null, updatedAt: null }] } };
      if (path === "/api/cards/card-1" && options?.method === "PATCH") return { item: { ...card, listId: "progress" } };
      if (path === "/api/cards/card-1/comments" && options?.method === "POST") return { item: comment };
      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await performWorkflowAction({ action: "start_working", cardId: "card-1" });
    expect(result).toMatchObject({ success: true, listId: "progress", card: { id: "card-1", listId: "progress" }, comment });
    expect(mockPlankaRequest.mock.calls.map((call: any[]) => call[0])).toEqual([
      "/api/cards/card-1", "/api/boards/board-1", "/api/boards/board-1", "/api/cards/card-1", "/api/cards/card-1/comments",
    ]);
    expect(result.card).not.toHaveProperty("labelIds");
  });
});
