import mongoose from 'mongoose';
import Task from '../models/Task.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

const parseBoolean = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const handleDBError = (res, error) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, error: error.message });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ success: false, error: 'Invalid task id format' });
  }

  if (error.code === 11000) {
    return res.status(409).json({ success: false, error: 'Duplicate data conflict' });
  }

  return res.status(500).json({ success: false, error: 'Database operation failed' });
};

export const getTasks = async (req, res) => {
  try {
    const completedFilter = parseBoolean(req.query.completed);
    const filter = completedFilter === undefined ? {} : { completed: completedFilter };

    const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    return handleDBError(res, error);
  }
};

export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean();

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return handleDBError(res, error);
  }
};

export const createTask = async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ success: false, error: 'Database unavailable. Please retry shortly.' });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const created = await Task.create([{ text: req.body.text }], { session });

    await session.commitTransaction();
    return res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    await session.abortTransaction();
    return handleDBError(res, error);
  } finally {
    session.endSession();
  }
};

export const updateTask = async (req, res) => {
  try {
    const payload = {};

    if (req.body.text !== undefined) payload.text = req.body.text;
    if (req.body.completed !== undefined) payload.completed = req.body.completed;

    const task = await Task.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return handleDBError(res, error);
  }
};

export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    return res.status(204).end();
  } catch (error) {
    return handleDBError(res, error);
  }
};

export const searchTasks = async (req, res) => {
  try {
    const query = (req.query.q || '').trim();

    if (!query) {
      return res.status(400).json({ success: false, error: 'Search query q is required' });
    }

    const results = await Task.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .lean();

    return res.status(200).json({ success: true, count: results.length, data: results });
  } catch (error) {
    return handleDBError(res, error);
  }
};

export const getPaginatedTasks = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const skip = (page - 1) * limit;

    const [tasks, count] = await Promise.all([
      Task.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Task.countDocuments()
    ]);

    return res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        currentPage: page,
        limit,
        totalPages: Math.ceil(count / limit),
        totalItems: count
      }
    });
  } catch (error) {
    return handleDBError(res, error);
  }
};
