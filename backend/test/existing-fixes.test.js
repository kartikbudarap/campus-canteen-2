const { test } = require("node:test");
const assert = require("node:assert/strict");
const { errorHandler } = require("../src/middlewares/error.middleware");
const { toggleCanteenStatus } = require("../src/controllers/canteen.controller");
const FoodItem = require("../src/models/foodItem.model");

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("error handler maps duplicate, validation, cast, and unexpected errors", () => {
  const cases = [
    [{ code: 11000, keyValue: { code: "x" }, message: "duplicate" }, 400],
    [{ name: "ValidationError", errors: { x: { message: "bad field" } } }, 400],
    [{ name: "CastError", kind: "ObjectId", message: "bad id" }, 404],
    [new Error("private database detail"), 500],
  ];
  for (const [error, expected] of cases) {
    const res = response();
    errorHandler(error, {}, res, () => {});
    assert.equal(res.statusCode, expected);
    if (expected === 500 && process.env.NODE_ENV !== "development") {
      assert.equal(res.body.message, "Internal Server Error");
    }
  }
});

test("status endpoint rejects string booleans before database access", async () => {
  const res = response();
  await toggleCanteenStatus({ body: { isOpen: "false" }, params: { id: "x" } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 400);
});

test("food stock must be a whole number", async () => {
  const item = new FoodItem({ canteenId: "507f1f77bcf86cd799439011", name: "Tea", price: 1000,
    stock: 1.5, category: "Drinks" });
  await assert.rejects(item.validate(), (error) => Boolean(error.errors.stock));
});

