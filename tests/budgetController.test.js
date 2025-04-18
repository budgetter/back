const request = require("supertest");
const app = require("../app");
const sequelize = require("../config/database");

describe("Budget API Endpoints", () => {
  let token;
  let transaction;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Register a test user via API to trigger hooks and side effects
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "testuser@example.com",
      password: "Password123!",
    });

    expect([201, 400]).toContain(registerRes.statusCode);

    // Login to get JWT token
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "testuser@example.com",
      password: "Password123!",
    });

    expect([200, 401]).toContain(loginRes.statusCode);
    if (loginRes.statusCode === 200) {
      token = loginRes.body.token;
    }
  });

  beforeEach(async () => {
    transaction = await sequelize.transaction();
  });

  afterEach(async () => {
    await transaction.rollback();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("GET /api/budgets/current - should return current budget for authenticated user", async () => {
    const res = await request(app)
      .get("/api/budgets/current")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("startDate");
    expect(res.body).toHaveProperty("endDate");
  });
});
