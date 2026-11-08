import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPlankaRequest = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule("../../common/utils.js", () => ({
  plankaRequest: mockPlankaRequest,
  sanitizeId: (id: string) => id,
}));

// Dynamically import after mocking
const { getCardDetails } = await import("../../tools/card-details.js");

describe("tools/card-details: getCardDetails", () => {
  beforeEach(() => {
    mockPlankaRequest.mockReset();
  });

  it("should resolve boardId directly from card.boardId without querying lists", async () => {
    const mockCard = {
      id: "card-1",
      name: "Test Card",
      listId: "list-1",
      boardId: "board-1",
      type: "project",
      description: "Description",
      position: 100,
      dueDate: null,
      stopwatch: null,
      createdAt: null,
      updatedAt: null,
    };

    mockPlankaRequest.mockImplementation(async (path: string) => {
      if (path === "/api/cards/card-1") {
        return {
          item: mockCard,
          included: {
            taskLists: [{ id: "tl-1" }],
            cardLabels: [{ id: "cl-1", cardId: "card-1", labelId: "l1", createdAt: null, updatedAt: null }],
          },
        };
      }
      if (path === "/api/task-lists/tl-1") {
        return {
          included: {
            tasks: [
              {
                id: "t1",
                taskListId: "tl-1",
                name: "Task 1",
                isCompleted: true,
                position: 1,
                createdAt: null,
                updatedAt: null,
              },
              {
                id: "t2",
                taskListId: "tl-1",
                name: "Task 2",
                isCompleted: false,
                position: 2,
                createdAt: null,
                updatedAt: null,
              },
            ],
          },
        };
      }
      if (path === "/api/cards/card-1/comments") {
        return { items: [] };
      }
      if (path === "/api/boards/board-1/labels") {
        return { items: [{ id: "l1", name: "Bug", color: "berry-red", boardId: "board-1" }, { id: "unused", name: "Unused", color: "lagoon-blue", boardId: "board-1" }] };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await getCardDetails({ cardId: "card-1" });

    expect(result.card.id).toBe("card-1");
    expect(result.taskStats.total).toBe(2);
    expect(result.taskStats.completed).toBe(1);
    expect(result.taskStats.completionPercentage).toBe(50);
    expect((result.card as any).labelIds).toEqual(["l1"]);
    expect((result.card as any).labels).toEqual([{ id: "l1", name: "Bug", color: "berry-red" }]);
    expect(result.labels).toEqual((result.card as any).labels);

    // Verify /api/lists/ was NOT called because card already had boardId!
    const calls = mockPlankaRequest.mock.calls.map((c: any[]) => c[0]);
    expect(calls.some((c: string) => c.includes("/api/lists/"))).toBe(false);
  });

  it("should resolve boardId from getList in O(1) when card.boardId is absent", async () => {
    const mockCardWithoutBoard = {
      id: "card-2",
      name: "Card Without Board",
      listId: "list-99",
      type: "story",
      description: null,
      position: 200,
      dueDate: null,
      stopwatch: null,
      createdAt: null,
      updatedAt: null,
    };

    mockPlankaRequest.mockImplementation(async (path: string) => {
      if (path === "/api/cards/card-2") {
        return { item: mockCardWithoutBoard, included: { cardLabels: [{ id: "cl-2", cardId: "card-2", labelId: "l2", createdAt: null, updatedAt: null }] } };
      }
      if (path === "/api/cards/card-2/comments") {
        return { items: [] };
      }
      if (path === "/api/lists/list-99") {
        return {
          item: {
            id: "list-99",
            boardId: "board-resolved-from-list",
            name: "To Do",
            position: 1,
            createdAt: null,
            updatedAt: null,
          },
        };
      }
      if (path === "/api/boards/board-resolved-from-list/labels") {
        return { items: [{ id: "l2", boardId: "board-resolved-from-list", name: "Urgent", color: "berry-red" }] };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await getCardDetails({ cardId: "card-2" });

    expect(result.card.id).toBe("card-2");
    expect(result.labels).toEqual([{ id: "l2", name: "Urgent", color: "berry-red" }]);
    const calls = mockPlankaRequest.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toContain("/api/lists/list-99");
    expect(calls).toContain("/api/boards/board-resolved-from-list/labels");
  });

  it("should handle orphaned lists gracefully without crashing (boardId = null)", async () => {
    const mockOrphanCard = {
      id: "card-orphan",
      name: "Orphan Card",
      listId: "non-existent-list",
      type: "project",
      description: null,
      position: 1,
      dueDate: null,
      stopwatch: null,
      createdAt: null,
      updatedAt: null,
    };

    mockPlankaRequest.mockImplementation(async (path: string) => {
      if (path === "/api/cards/card-orphan") {
        return { item: mockOrphanCard, included: { cardLabels: [{ id: "cl-orphan", cardId: "card-orphan", labelId: "missing", createdAt: null, updatedAt: null }] } };
      }
      if (path === "/api/cards/card-orphan/comments") {
        return { items: [] };
      }
      if (path === "/api/lists/non-existent-list") {
        throw new Error("List not found");
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await getCardDetails({ cardId: "card-orphan" });

    expect(result.card.id).toBe("card-orphan");
    expect((result.card as any).labelIds).toEqual(["missing"]);
    expect(result.labels).toEqual([]);
    expect(result.analysis.isComplete).toBe(false);
  });
});
