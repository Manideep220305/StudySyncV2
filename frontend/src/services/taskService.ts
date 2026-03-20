import { apiClient, unwrapApiData } from '@/services/apiClient';

// Base URL for all task-related API calls.
// All task routes are protected — the backend's `protect` middleware validates
// the JWT from the httpOnly cookie on every request.
// --- TypeScript: Define the shape of data we send to create or update a task ---
// Partial<> means all fields are optional — useful for the update call where
// we might only send { isCompleted: true } or just { title: 'new title' }.
interface TaskPayload {
  title?: string;
  isCompleted?: boolean;
  xpValue?: number;
}

// For creating tasks, 'title' is strictly required.
interface CreateTaskPayload {
  title: string;
  isCompleted?: boolean;
  xpValue?: number;
}

// GET /api/tasks — fetch all tasks belonging to the currently logged-in user
const getTasks = async () => {
  const response = await apiClient.get('/tasks');
  return unwrapApiData(response.data);
};

// POST /api/tasks — create a new task
// 'taskData' must include at least a 'title' (required by the Task schema on the backend)
const createTask = async (taskData: CreateTaskPayload) => {
  const response = await apiClient.post('/tasks', taskData);
  return unwrapApiData(response.data);
};

// PUT /api/tasks/:id — update a specific task by its MongoDB _id
// 'id' is the task's _id from MongoDB. 'taskData' is the partial update (e.g., toggle isCompleted).
const updateTask = async (id: string, taskData: TaskPayload) => {
  const response = await apiClient.put(`/tasks/${id}`, taskData);
  return unwrapApiData(response.data);
};

// DELETE /api/tasks/:taskId — permanently delete a task by its MongoDB _id
const deleteTask = async (taskId: string) => {
  const response = await apiClient.delete(`/tasks/${taskId}`);
  return unwrapApiData(response.data);
};

// Bundle all functions into a single service object — this pattern keeps
// all API calls for one resource in one file, making them easy to find and change.
const taskService = {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
};

export default taskService;
