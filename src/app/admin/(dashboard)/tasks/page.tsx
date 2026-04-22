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
import AssigneePicker from "@/components/admin/AssigneePicker";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { success as hapticSuccess, tapLight } from "@/lib/haptic";

// ---------- Types ----------

type TaskStatus = "TODO" | "DONE";

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignees: { id: string; name: string }[];
  dueDate?: string | null;
  order: number;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AssigneesBadge({ assignees }: { assignees: Task["assignees"] }) {
  if (!assignees || assignees.length === 0) return null;
  if (assignees.length === 1) {
    return (
      <div
        title={assignees[0].name}
        className="w-6 h-6 rounded-full bg-pink/20 text-pink flex items-center justify-center text-[10px] font-bold"
      >
        {initialsOf(assignees[0].name)}
      </div>
    );
  }
  return (
    <div className="flex -space-x-1.5 rtl:space-x-reverse" title={assignees.map((a) => a.name).join(" + ")}>
      {assignees.slice(0, 3).map((a) => (
        <div
          key={a.id}
          className="w-6 h-6 rounded-full bg-pink/20 text-pink flex items-center justify-center text-[10px] font-bold border-2 border-gray-800"
        >
          {initialsOf(a.name)}
        </div>
      ))}
    </div>
  );
}

interface User {
  id: string;
  name: string;
}

// ---------- Constants ----------

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: "TODO", label: "לבצע", color: "bg-pink" },
  { id: "DONE", label: "הושלם", color: "bg-green-500" },
];

// ---------- TaskCard Component ----------

function StatusToggle({
  status,
  onToggle,
}: {
  status: TaskStatus;
  onToggle: () => void;
}) {
  const done = status === "DONE";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={done ? "סמן כלא בוצע" : "סמן כבוצע"}
      title={done ? "סמן כלא בוצע" : "סמן כבוצע"}
      className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
        done
          ? "bg-green-500 border-green-500 text-white"
          : "border-gray-600 hover:border-green-500 text-transparent hover:text-green-500/50"
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
}

function TaskCard({
  task,
  overlay,
  onToggleStatus,
}: {
  task: Task;
  overlay?: boolean;
  onToggleStatus?: (task: Task) => void;
}) {
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
      <div className="flex items-start gap-3">
        {onToggleStatus && (
          <StatusToggle status={task.status} onToggle={() => onToggleStatus(task)} />
        )}
        <p
          className={`flex-1 text-sm font-medium leading-snug ${
            task.status === "DONE" ? "text-gray-500 line-through" : "text-white"
          }`}
        >
          {task.title}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        {task.dueDate ? (
          <span className="text-[11px] text-gray-500">
            {new Date(task.dueDate).toLocaleDateString("he-IL")}
          </span>
        ) : (
          <span />
        )}
        <AssigneesBadge assignees={task.assignees} />
      </div>
    </div>
  );
}

// ---------- MobileTaskCard (no DnD) ----------

function MobileTaskCard({
  task,
  onToggleStatus,
}: {
  task: Task;
  onToggleStatus: (task: Task) => void;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 active:bg-gray-700 transition-colors space-y-3">
      <div className="flex items-start gap-3">
        <StatusToggle status={task.status} onToggle={() => onToggleStatus(task)} />
        <Link href={`/admin/tasks/${task.id}`} className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-snug ${
              task.status === "DONE" ? "text-gray-500 line-through" : "text-white"
            }`}
          >
            {task.title}
          </p>
        </Link>
      </div>
      <div className="flex items-center justify-between gap-2">
        {task.dueDate ? (
          <span className="text-[11px] text-gray-500">
            {new Date(task.dueDate).toLocaleDateString("he-IL")}
          </span>
        ) : (
          <span />
        )}
        <AssigneesBadge assignees={task.assignees} />
      </div>
    </div>
  );
}

// ---------- KanbanColumn Component ----------

function KanbanColumn({
  column,
  tasks,
  onToggleStatus,
}: {
  column: (typeof columns)[0];
  tasks: Task[];
  onToggleStatus: (task: Task) => void;
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
            <TaskCard key={task.id} task={task} onToggleStatus={onToggleStatus} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ---------- Main Page ----------

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Filter
  const [filterAssignee, setFilterAssignee] = useState("");

  // Mobile UI
  const [activeTab, setActiveTab] = useState<TaskStatus>("TODO");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/users"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(Array.isArray(data) ? data : data.data || data.tasks || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      } else {
        console.error("Failed to load users:", usersRes.status);
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
    if (filterAssignee && !t.assignees.some((a) => a.id === filterAssignee)) return false;
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
    if (newAssigneeIds.length === 0) {
      toast.error("יש לבחור לפחות משתמש אחד");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          assigneeIds: newAssigneeIds,
          ...(newDueDate ? { dueDate: newDueDate } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("המשימה נוצרה");
      setCreateOpen(false);
      setNewTitle("");
      setNewAssigneeIds([]);
      setNewDueDate("");
      fetchData();
    } catch {
      toast.error("שגיאה ביצירת המשימה");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = useCallback(async (task: Task) => {
    const next: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
    if (next === "DONE") hapticSuccess();
    else tapLight();
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next === "DONE" ? "סומן כבוצע" : "הוחזר ללבצע", {
        duration: 1500,
        style: { fontSize: "13px" },
      });
    } catch {
      toast.error("שגיאה בעדכון");
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  }, []);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    <PullToRefresh onRefresh={fetchData}>
    <div className="tasks-area space-y-6">
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

      {/* Filter */}
      <div className="flex flex-wrap gap-3">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={getColumnTasks(col.id)}
                onToggleStatus={handleToggleStatus}
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
              <MobileTaskCard key={task.id} task={task} onToggleStatus={handleToggleStatus} />
            ))
          )}
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          aria-label="משימה חדשה"
          className="md:hidden fixed safe-bottom right-5 z-40 w-14 h-14 rounded-full bg-cyan hover:bg-cyan/80 shadow-lg shadow-cyan/30 flex items-center justify-center text-black"
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
            <label className="block text-sm text-gray-400 mb-1">משויך ל *</label>
            <AssigneePicker
              users={users}
              selectedIds={newAssigneeIds}
              onChange={setNewAssigneeIds}
            />
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
              disabled={creating || !newTitle.trim() || newAssigneeIds.length === 0}
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
    </PullToRefresh>
  );
}
