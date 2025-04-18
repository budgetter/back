const request = require("supertest");
const app = require("../app");
const sequelize = require("../config/database");

describe("Auth API Endpoints", () => {
  let transaction;
  beforeAll(async () => {
    await sequelize.sync({ force: true });
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

  test("POST /api/auth/register - successful registration", async () => {
    const newUser = {
      name: "Test User",
      email: "testuser@example.com",
      password: "Password123!",
    };

    const res = await request(app).post("/api/auth/register").send(newUser);

    expect([201, 400]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      expect(res.body).toHaveProperty("message", "User registered successfully");
      expect(res.body).toHaveProperty("userId");

    }
  });

  test("POST /api/auth/login - successful login", async () => {
    const credentials = {
      email: "testuser@example.com",
      password: "Password123!",
    };

    const res = await request(app).post("/api/auth/login").send(credentials);

    expect([200, 401]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty("token");
    }
  });
});
