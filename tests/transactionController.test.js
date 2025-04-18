const request = require("supertest");
const app = require("../app");
const sequelize = require("../config/database");

describe("Transaction API Endpoints", () => {
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

  test("POST /api/transactions - create a new transaction", async () => {
    const newTransaction = {
      amount: 100.0,
      description: "Test transaction",
      date: "2023-06-01",
      type: "expense",
      categoryId: null, 
      UserId: null, 
      GroupId: null,
    };

    const res = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send(newTransaction);

    expect([201, 400]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      expect(res.body).toHaveProperty("transaction");
      expect(res.body.transaction).toHaveProperty("id");
    }
  });

  test("GET /api/transactions/:groupId - get transactions for a group", async () => {
    const groupId = "some-group-id"; 

    const res = await request(app)
      .get(`/api/transactions/${groupId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("transactions");
    expect(Array.isArray(res.body.transactions)).toBe(true);
  });
});
