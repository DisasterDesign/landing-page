"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Modal from "@/components/ui/Modal";

// ---------- Types ----------

type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  dueDate?: string | null;
  order: number;
}

interface Project {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
}

// ---------- Constants ----------

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: "TODO", label: "לביצוע", color: "bg-gray-500" },
  { id: "IN_PROGRESS", label: "בביצוע", color: "bg-cyan" },
  { id: "REVIEW", label: "לבדיקה", color: "bg-yellow-500" },
  { id: "DONE", label: "הושלם", color: "bg-green-500" },
];

const priorityConfig: Record<Priority, { label: string; color: string }> = {
  LOW: { label: "נמוכה", color: "bg-gray-600 text-gray-300" },
  MEDIUM: { label: "בינונית", color: "bg-blue-900/60 text-blue-300" },
  HIGH: { label: "גבוהה", color: "bg-orange-900/60 text-orange-300" },
  URGENT: { label: "דחופה", color: "bg-red-900/60 text-red-300" },
};

// ---------- TaskCard Component ----------

function TaskCard({ task, overlay }: { task: Task; overlay?: boolean }) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = overlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      };

  const initials = task.assignee
    ? task.assignee.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => {
        if (!isDragging) router.push(`/admin/tasks/${task.id}`);
      }}
      className={`bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors space-y-3 ${
        overlay ? "shadow-2xl ring-2 ring-pink/50" : ""
      }`}
    >
      <p className="text-sm font-medium text-white leading-snug">{task.title}</p>

      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            priorityConfig[task.priority].color
          }`}
        >
          {priorityConfig[task.priority].label}
        </span>

        {initials && (
          <div className="w-6 h-6 rounded-full bg-pink/20 text-pink flex items-center justify-center text-[10px] font-bold">
            {initials}
          </div>
        )}
      </div>

      {task.dueDate && (
        <p className="text-[11px] text-gray-500">
          {new Date(task.dueDate).toLocaleDateString("he-IL")}
        </p>
      )}
    </div>
  );
}

// ---------- MobileTaskCard (no DnD) ----------

function MobileTaskCard({ task }: { task: Task }) {
  const initials = task.assignee
    ? task.assignee.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <Link
      href={`/admin/tasks/${task.id}`}
      className="block bg-gray-800 rounded-xl p-4 border border-gray-700 active:bg-gray-700 transition-colors space-y-3"
    >
      <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            priorityConfig[task.priority].color
          }`}
        >
          {priorityConfig[task.priority].label}
        </span>
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className="text-[11px] text-gray-500">
              {new Date(task.dueDate).toLocaleDateString("he-IL")}
            </span>
          )}
          {initials && (
            <div className="w-6 h-6 rounded-full bg-pink/20 text-pink flex items-center justify-center text-[10px] font-bold">
              {initials}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------- KanbanColumn Component ----------

function KanbanColumn({
  column,
  tasks,
}: {
  column: (typeof columns)[0];
  tasks: Task[];
}) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: { type: "column" },
  });

  return (
    <div
      ref={setNodeRef}
      className="bg-gray-900 rounded-2xl border border-gray-700 flex flex-col min-h-[400px]"
    >
      <div className="p-4 border-b border-gray-700 flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${column.color}`} />
        <h3 className="text-sm font-bold">{column.label}</h3>
        <span className="text-xs text-gray-500 mr-auto">{tasks.length}</span>
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-3 space-y-3 flex-1">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ---------- Main Page ----------

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Filters
  const [filterProject, setFilterProject] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  // Mobile UI
  const [activeTab, setActiveTab] = useState<TaskStatus>("TODO");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("MEDIUM");
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, projectsRes, usersRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/projects"),
        fetch("/api/users"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(Array.isArray(data) ? data : data.data || data.tasks || []);
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(Array.isArray(data) ? data : data.data || data.projects || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTasks = tasks.filter((t) => {
    if (filterProject && t.project?.id !== filterProject) return false;
    if (filterAssignee && t.assignee?.id !== filterAssignee) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const getColumnTasks = (status: TaskStatus) =>
    filteredTasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.order - b.order);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Check if over a column directly
    const overColumn = columns.find((c) => c.id === overId);
    if (overColumn && activeTask.status !== overColumn.id) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: overColumn.id } : t
        )
      );
      return;
    }

    // Over another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && activeTask.status !== overTask.status) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: overTask.status } : t
        )
      );
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          ...(newAssignee ? { assigneeId: newAssignee } : {}),
          ...(newDueDate ? { dueDate: newDueDate } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("המשימה נוצרה");
      setCreateOpen(false);
      setNewTitle("");
      setNewAssignee("");
      setNewPriority("MEDIUM");
      setNewDueDate("");
      fetchData();
    } catch {
      toast.error("שגיאה ביצירת המשימה");
    } finally {
      setCreating(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    try {
      await fetch("/api/tasks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: [
            {
              id: activeId,
              status: task.status,
              order: task.order,
            },
          ],
        }),
      });
    } catch (err) {
      console.error("Failed to reorder task:", err);
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map((col) => (
            <div
              key={col.id}
              className="bg-gray-900 rounded-2xl border border-gray-700 h-96 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold">משימות</h2>
        <Link
          href="/admin/tasks/new"
          className="flex items-center gap-2 px-4 py-2 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          הוסף משימה
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
        >
          <option value="">כל הפרויקטים</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
        >
          <option value="">כל המשתמשים</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
        >
          <option value="">כל העדיפויות</option>
          <option value="LOW">נמוכה</option>
          <option value="MEDIUM">בינונית</option>
          <option value="HIGH">גבוהה</option>
          <option value="URGENT">דחופה</option>
        </select>
      </div>

      {/* Kanban Board (desktop) */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={getColumnTasks(col.id)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile tabs + list */}
      <div className="md:hidden">
        <div className="flex gap-1 bg-gray-900 border border-gray-700 rounded-2xl p-1 mb-4 overflow-x-auto">
          {columns.map((col) => {
            const active = activeTab === col.id;
            const count = getColumnTasks(col.id).length;
            return (
              <button
                key={col.id}
                onClick={() => setActiveTab(col.id)}
                className={`flex-1 min-w-[72px] flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-bold transition-colors ${
                  active ? "bg-pink text-white" : "text-gray-400"
                }`}
              >
                <span>{col.label}</span>
                <span
                  className={`text-[10px] px-1.5 rounded-full ${
                    active ? "bg-white/25" : "bg-gray-800"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {getColumnTasks(activeTab).length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-12">
              אין משימות בקטגוריה זו
            </p>
          ) : (
            getColumnTasks(activeTab).map((task) => (
              <MobileTaskCard key={task.id} task={task} />
            ))
          )}
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          aria-label="משימה חדשה"
          className="md:hidden fixed bottom-24 left-4 z-40 w-14 h-14 rounded-full bg-pink hover:bg-pink-light shadow-lg shadow-pink/30 flex items-center justify-center text-white"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="משימה חדשה">
        <form onSubmit={handleQuickCreate} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-sm text-gray-400 mb-1">כותרת *</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              placeholder="מה צריך לעשות?"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">משויך ל</label>
            <select
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            >
              <option value="">ללא</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">עדיפות</label>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as Priority)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            >
              <option value="LOW">נמוכה</option>
              <option value="MEDIUM">בינונית</option>
              <option value="HIGH">גבוהה</option>
              <option value="URGENT">דחופה</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">תאריך יעד</label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="flex-1 bg-pink hover:bg-pink-light disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
            >
              {creating ? "יוצר..." : "צור משימה"}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-xl"
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
