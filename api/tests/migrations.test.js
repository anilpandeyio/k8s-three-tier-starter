const { ensureSourceColumn } = require("../src/migrations");

function mockPool({ columns = [], lockResult = 1 } = {}) {
  const connection = {
    query: jest.fn(async (sql) => {
      if (sql.includes("GET_LOCK")) {
        return [[{ acquired: lockResult }]];
      }
      if (sql.includes("information_schema.COLUMNS")) {
        return [columns];
      }
      return [[]];
    }),
    release: jest.fn(),
  };

  return {
    pool: { getConnection: jest.fn().mockResolvedValue(connection) },
    connection,
  };
}

describe("ensureSourceColumn", () => {
  it("adds source when it is missing and releases the migration lock", async () => {
    const { pool, connection } = mockPool();

    await expect(ensureSourceColumn(pool)).resolves.toBe(true);

    expect(connection.query).toHaveBeenCalledWith(
      "ALTER TABLE quotes ADD COLUMN source varchar(255) DEFAULT NULL"
    );
    expect(connection.query).toHaveBeenCalledWith(
      "SELECT RELEASE_LOCK(?)",
      ["quotes-schema-migrations"]
    );
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it("does not alter the table when source already exists", async () => {
    const { pool, connection } = mockPool({ columns: [{ COLUMN_NAME: "source" }] });

    await expect(ensureSourceColumn(pool)).resolves.toBe(false);

    expect(connection.query).not.toHaveBeenCalledWith(
      "ALTER TABLE quotes ADD COLUMN source varchar(255) DEFAULT NULL"
    );
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it("fails clearly when it cannot acquire the migration lock", async () => {
    const { pool, connection } = mockPool({ lockResult: 0 });

    await expect(ensureSourceColumn(pool)).rejects.toThrow(
      "Unable to acquire database schema migration lock"
    );
    expect(connection.query).not.toHaveBeenCalledWith(
      "ALTER TABLE quotes ADD COLUMN source varchar(255) DEFAULT NULL"
    );
    expect(connection.release).toHaveBeenCalledTimes(1);
  });
});
