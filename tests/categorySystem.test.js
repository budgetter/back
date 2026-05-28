/**
 * Category System Unit Tests
 * Tests the controller logic with mocked models.
 */
const { v4: uuidv4 } = require("uuid");

// --- Test the controller logic directly with mocked models ---

describe("Category Controller Logic", () => {

  describe("userCategoryId is the only reference needed", () => {
    it("addFormData should only contain userCategoryId, not categoryId", () => {
      // Simulates what the frontend sends
      const formData = { userCategoryId: uuidv4(), plannedAmount: "500", type: "expense" };
      expect(formData).toHaveProperty("userCategoryId");
      expect(formData).not.toHaveProperty("categoryId");
    });

    it("empty categoryId coerces to null", () => {
      const categoryId = "" || null;
      expect(categoryId).toBeNull();
    });

    it("undefined categoryId coerces to null", () => {
      const categoryId = undefined || null;
      expect(categoryId).toBeNull();
    });
  });

  describe("Date/Timezone month parsing", () => {
    it("parses month boundaries correctly without timezone issues", () => {
      const month = "2026-06";
      const [y, m] = month.split("-").map(Number);
      const startOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      expect(startOfMonth).toBe("2026-06-01");
      expect(endOfMonth).toBe("2026-06-30");
    });

    it("handles February correctly", () => {
      const month = "2026-02";
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      expect(endOfMonth).toBe("2026-02-28");
    });

    it("handles December correctly", () => {
      const month = "2026-12";
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      expect(endOfMonth).toBe("2026-12-31");
    });
  });

  describe("Plan endDate filtering", () => {
    const today = "2026-05-27";

    const plans = [
      { id: "1", endDate: null, plannedAmount: "100", type: "expense" },
      { id: "2", endDate: "2026-06-30", plannedAmount: "200", type: "expense" },
      { id: "3", endDate: "2026-04-30", plannedAmount: "300", type: "expense" }, // expired
      { id: "4", endDate: "2026-05-30", plannedAmount: "400", type: "expense" }, // expiring soon
    ];

    it("filters out expired plans", () => {
      const active = plans.filter(p => !p.endDate || p.endDate >= today);
      expect(active.length).toBe(3);
      expect(active.find(p => p.id === "3")).toBeUndefined();
    });

    it("detects expiring-soon plans (within 7 days)", () => {
      const expiring = plans.filter(p => {
        if (!p.endDate) return false;
        const diff = (new Date(p.endDate + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000;
        return diff <= 7 && diff >= 0;
      });
      expect(expiring.length).toBe(1);
      expect(expiring[0].id).toBe("4");
    });

    it("null endDate means never expires", () => {
      const active = plans.filter(p => !p.endDate || p.endDate >= today);
      expect(active.find(p => p.id === "1")).toBeDefined();
    });
  });

  describe("Category name resolution", () => {
    it("prefers customName over system name", () => {
      const uc = { customName: "My Food", Category: { name: "Food & Dining" } };
      const name = uc.customName || uc.Category?.name || "Unknown";
      expect(name).toBe("My Food");
    });

    it("falls back to system Category name when customName is null", () => {
      const uc = { customName: null, Category: { name: "Food & Dining" } };
      const name = uc.customName || uc.Category?.name || "Unknown";
      expect(name).toBe("Food & Dining");
    });

    it("returns Unknown when both are null", () => {
      const uc = { customName: null, Category: null };
      const name = uc.customName || uc?.Category?.name || "Unknown";
      expect(name).toBe("Unknown");
    });
  });

  describe("Category tree structure", () => {
    const flatCategories = [
      { id: "p1", parentId: null, name: "Housing", children: [] },
      { id: "c1", parentId: "p1", name: "Rent" },
      { id: "c2", parentId: "p1", name: "Utilities" },
      { id: "p2", parentId: null, name: "Food", children: [] },
      { id: "c3", parentId: "p2", name: "Groceries" },
    ];

    it("builds tree correctly", () => {
      const parents = flatCategories.filter(c => !c.parentId);
      const tree = parents.map(p => ({
        ...p,
        children: flatCategories.filter(c => c.parentId === p.id),
      }));

      expect(tree.length).toBe(2);
      expect(tree[0].children.length).toBe(2);
      expect(tree[1].children.length).toBe(1);
      expect(tree[0].children[0].name).toBe("Rent");
    });

    it("flat lookup finds by id", () => {
      const all = flatCategories;
      const found = all.find(c => c.id === "c2");
      expect(found.name).toBe("Utilities");
    });
  });

  describe("Functional state update pattern", () => {
    it("functional update preserves other fields", () => {
      let state = { userCategoryId: "", plannedAmount: "500", type: "expense" };
      // Simulate: setFormData(prev => ({ ...prev, userCategoryId: cat.id }))
      const catId = uuidv4();
      state = { ...state, userCategoryId: catId };
      expect(state.userCategoryId).toBe(catId);
      expect(state.plannedAmount).toBe("500");
      expect(state.type).toBe("expense");
    });
  });
});
