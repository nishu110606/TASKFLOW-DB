import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Task from '../models/Task.js';

dotenv.config();

const checks = [];
const addCheck = (name, pass, details = '') => {
  checks.push({ name, pass, details });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark}: ${name}${details ? ` - ${details}` : ''}`);
};

const run = async () => {
  const uri = process.env.MONGODB_URI;

  addCheck('MONGODB_URI is configured', Boolean(uri));
  if (!uri) {
    process.exit(1);
  }

  const hasDbName = /mongodb\.net\/[a-zA-Z0-9_-]+\?/.test(uri);
  addCheck('MONGODB_URI includes database name', hasDbName);

  let connected = false;
  let createdTaskId;

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || 'taskflow',
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2
    });

    connected = mongoose.connection.readyState === 1;
    addCheck('MongoDB connection established', connected, connected ? mongoose.connection.host : 'not connected');

    if (!connected) {
      throw new Error('MongoDB connection not ready');
    }

    await Task.init();
    await Task.createCollection().catch(() => {});
    const indexes = await Task.collection.indexes();
    const hasText = indexes.some((idx) => idx.name === 'text_text');
    const hasCompound = indexes.some((idx) => idx.name === 'completed_1_createdAt_-1');

    addCheck('Text index exists on task text', hasText);
    addCheck('Compound index exists on completed+createdAt', hasCompound);

    const created = await Task.create({
      text: `task4-smoke-${Date.now()}`,
      completed: false
    });
    createdTaskId = created._id;
    addCheck('Create operation works', Boolean(createdTaskId));

    const fetched = await Task.findById(createdTaskId).lean();
    addCheck('Read operation works', Boolean(fetched && fetched._id));

    const updated = await Task.findByIdAndUpdate(
      createdTaskId,
      { completed: true, text: `${created.text} updated` },
      { new: true, runValidators: true }
    );
    addCheck('Update operation works', Boolean(updated && updated.completed === true));

    const search = await Task.find(
      { $text: { $search: 'task4-smoke' } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(5)
      .lean();
    addCheck('Text search query works', Array.isArray(search));

    const page = await Task.find().sort({ createdAt: -1 }).limit(2).lean();
    addCheck('Pagination query shape works', Array.isArray(page));

    const explain = await Task.find({ completed: true }).limit(1).explain('executionStats');
    addCheck(
      'Explain executionStats works',
      Boolean(explain && explain.executionStats),
      explain?.queryPlanner?.winningPlan?.stage || 'ok'
    );

    const deleted = await Task.findByIdAndDelete(createdTaskId);
    addCheck('Delete operation works', Boolean(deleted));
    createdTaskId = undefined;
  } catch (error) {
    addCheck('Runtime validation', false, error.message);
  } finally {
    if (createdTaskId) {
      await Task.findByIdAndDelete(createdTaskId).catch(() => {});
    }
    await mongoose.connection.close().catch(() => {});
  }

  const failed = checks.filter((item) => !item.pass);
  console.log('');
  console.log(`Summary: ${checks.length - failed.length}/${checks.length} checks passed`);

  if (failed.length) {
    process.exit(1);
  }
};

run();
