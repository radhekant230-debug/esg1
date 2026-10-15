const mongoose = require("mongoose");

const isTransactionUnsupported = (err) =>
  Boolean(
    err &&
      (err.code === 20 ||
        err.codeName === "IllegalOperation" ||
        /Transaction numbers are only allowed|replica set member or mongos|does not support transactions/i.test(
          err.message || ""
        ))
  );

/**
 * Runs `fn(session)` inside a MongoDB transaction (Atlas replica sets support
 * this). On a standalone local MongoDB that cannot run transactions, `fn` is
 * executed with `session = null`; callers that need atomicity in that mode
 * must perform their own compensation (see sales import commit).
 * Returns { result, transactional }.
 */
async function runInTransaction(fn) {
  try {
    let result;
    // connection.transaction() wraps session.withTransaction() and also resets
    // Mongoose document state if the transaction is retried or aborted.
    await mongoose.connection.transaction(async (session) => {
      result = await fn(session);
    });
    return { result, transactional: true };
  } catch (err) {
    if (isTransactionUnsupported(err)) {
      return { result: await fn(null), transactional: false };
    }
    throw err;
  }
}

module.exports = { runInTransaction, isTransactionUnsupported };
