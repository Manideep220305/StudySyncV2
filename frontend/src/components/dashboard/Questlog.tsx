import React, { useState, useEffect } from 'react';
import taskService from '../../services/taskService';
import { Plus, Trash2, CheckCircle, Circle, Edit2, Save, X } from 'lucide-react';

// --- TypeScript: Define the shape of a single Task object ---
// This mirrors the Task Mongoose schema on the backend (backend/models/Task.js).
// Every task from the API will have these fields.
interface Task {
  _id: string;
  title: string;
  isCompleted: boolean;
  xpValue?: number;
}

// QuestLog is the gamified To-Do list widget on the Dashboard.
// It fetches tasks from the backend on mount and supports:
// - Adding new tasks
// - Toggling completion (with optimistic updates)
// - Inline editing of task titles
// - Deleting tasks
// An "optimistic update" means we update the UI immediately without waiting for
// the server to confirm — and revert if the server call fails. This makes the UI feel instant.
const QuestLog = () => {
  // TypeScript: useState<Task[]>([]) tells TypeScript this is an array of Task objects
  const [tasks, setTasks] = useState<Task[]>([]);

  // 'text' is the controlled value for the "Add new quest..." input
  const [text, setText] = useState('');

  // 'editingId' tracks WHICH task is currently being edited (null = no edit in progress)
  // TypeScript: string | null means it can be a task ID or null
  const [editingId, setEditingId] = useState<string | null>(null);

  // 'editingText' holds the temporary text value while a task is being renamed
  const [editingText, setEditingText] = useState('');

  // 'error' holds any user-visible error message (empty string = no error)
  const [error, setError] = useState('');

  // Load all tasks from the backend when the component first renders
  useEffect(() => {
    loadTasks();
  }, []);

  // Fetches all tasks for the current user from the backend.
  // The taskService handles the axios call and cookie credentials.
  const loadTasks = async () => {
    try {
      setError('');
      const response = await taskService.getTasks();

      // The API returns tasks directly as an array, but this guard handles both cases
      const data = Array.isArray(response) ? response : (response?.data || []);

      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        console.error("Invalid tasks response:", response);
        setTasks([]);
      }
    } catch (error) {
      console.error("Failed to fetch tasks", error);
      setError("Failed to load tasks");
      setTasks([]);
    }
  };

  // Handles the "Add new quest" form submission.
  // Creates the task on the backend and prepends it to the local tasks list.
  // TypeScript: React.FormEvent is the type for a form's onSubmit event.
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) return; // Don't submit empty tasks

    try {
      setError('');
      const newTask = await taskService.createTask({
        title: trimmedText,
        xpValue: 10, // Default XP reward per quest
      });

      // Validate the response has a MongoDB _id before adding to state
      if (newTask && newTask._id) {
        setTasks(prev => [newTask, ...prev]); // Prepend so newest task is at the top
        setText(''); // Clear the input field
      } else {
        console.error("Invalid task response:", newTask);
        setError("Failed to add task");
      }
    } catch (error: any) {
      console.error("Failed to add task:", error);
      setError(error.response?.data?.message || "Failed to add task");
    }
  };

  // Toggles a task's isCompleted status.
  // Uses "Optimistic UI": we flip the state locally first so the UI responds instantly,
  // then confirm it with the server. If the server fails, we revert by reloading.
  const handleToggle = async (task: Task) => {
    try {
      setError('');
      // Step 1: Optimistically update the UI (map over tasks and flip the matching one)
      const updatedTasks = tasks.map((t) =>
        t._id === task._id ? { ...t, isCompleted: !t.isCompleted } : t
      );
      setTasks(updatedTasks);

      // Step 2: Confirm with the server
      await taskService.updateTask(task._id, { isCompleted: !task.isCompleted });
    } catch (error) {
      console.error("Failed to update task", error);
      setError("Failed to update task");
      // Step 3 (on failure): Revert to the real server state
      loadTasks();
    }
  };

  // Enters "edit mode" for a specific task by setting editingId and pre-filling editingText
  const handleStartEdit = (task: Task) => {
    setEditingId(task._id);
    setEditingText(task.title);
  };

  // Saves the edited task title to the backend.
  const handleSaveEdit = async (taskId: string) => {
    const trimmedText = editingText.trim();
    if (!trimmedText) {
      setError("Task title cannot be empty");
      return;
    }

    try {
      setError('');
      await taskService.updateTask(taskId, { title: trimmedText });
      // Update the title in local state (avoids a full re-fetch from the server)
      setTasks(tasks.map(t =>
        t._id === taskId ? { ...t, title: trimmedText } : t
      ));
      // Exit edit mode
      setEditingId(null);
      setEditingText('');
    } catch (error) {
      console.error("Failed to update task", error);
      setError("Failed to update task");
    }
  };

  // Cancels editing without saving — clears the edit state
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  // Deletes a task with optimistic removal — removes locally first, confirms with server.
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return; // User cancelled the confirmation dialog
    }

    try {
      setError('');
      // Optimistically remove from UI
      setTasks(tasks.filter((t) => t._id !== id));
      await taskService.deleteTask(id);
    } catch (error) {
      console.error("Failed to delete task", error);
      setError("Failed to delete task");
      // Revert on error
      loadTasks();
    }
  };

  // Derived values for the progress bar and counter display
  const completedCount = tasks.filter(t => t.isCompleted).length;
  const totalCount = tasks.length;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/50 rounded-xl p-6 h-full flex flex-col shadow-xl">
      {/* HEADER ROW: Title on left, completion counter on right */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-purple-400">⚔️</span>
            <span>Quest Log</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Track your daily quests</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{completedCount}/{totalCount}</div>
          <span className="text-xs text-slate-400">Complete</span>
        </div>
      </div>

      {/* PROGRESS BAR — only visible when there's at least one task */}
      {totalCount > 0 && (
        <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-300"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {/* ERROR BANNER — only visible when there's an error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-3">
          {error}
        </div>
      )}

      {/* ADD TASK FORM */}
      <form onSubmit={handleAddTask} className="flex gap-2 mb-5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a new quest..."
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition"
        />
        <button
          type="submit"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2.5 rounded-lg transition font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>

      {/* TASK LIST — scrollable area */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {tasks.length === 0 ? (
          // Empty state — shown when no tasks exist
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-2">🗡️</div>
            <p className="text-sm">No active quests. Add one to get started!</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task._id}
              className={`group flex items-center justify-between p-3.5 rounded-lg border transition-all duration-200 ${
                task.isCompleted
                  ? 'bg-slate-800/30 border-slate-800 opacity-70'
                  : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Completion toggle button */}
                <button
                  onClick={() => handleToggle(task)}
                  className="flex-shrink-0 transition-transform hover:scale-110"
                >
                  {task.isCompleted ? (
                    <CheckCircle className="text-green-500 w-5 h-5" />
                  ) : (
                    <Circle className="text-slate-400 w-5 h-5 hover:text-purple-400" />
                  )}
                </button>

                {/* EDIT MODE: shows an input field + save/cancel buttons */}
                {editingId === task._id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      autoFocus
                      className="flex-1 bg-slate-950 border border-purple-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveEdit(task._id)}
                      className="text-green-500 hover:text-green-400 transition"
                      title="Save"
                    >
                      <Save size={16} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-slate-500 hover:text-slate-400 transition"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  /* VIEW MODE: shows the task title with strikethrough if completed */
                  <span
                    className={`text-sm flex-1 truncate ${
                      task.isCompleted
                        ? 'text-slate-500 line-through'
                        : 'text-slate-200'
                    }`}
                  >
                    {task.title || 'Untitled Quest'}
                  </span>
                )}
              </div>

              {/* ACTION BUTTONS (Edit + Delete) — hidden by default, shown on hover via group-hover */}
              {editingId !== task._id && (
                <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => handleStartEdit(task)}
                    className="text-slate-500 hover:text-blue-400 transition p-1"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(task._id)}
                    className="text-slate-500 hover:text-red-400 transition p-1"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QuestLog;