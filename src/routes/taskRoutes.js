import { Router } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  searchTasks,
  getPaginatedTasks
} from '../controllers/taskController.js';

const router = Router();

router.get('/search', searchTasks);
router.get('/paginated', getPaginatedTasks);

router.route('/')
  .get(getTasks)
  .post(createTask);

router.route('/:id')
  .get(getTaskById)
  .put(updateTask)
  .delete(deleteTask);

export default router;
