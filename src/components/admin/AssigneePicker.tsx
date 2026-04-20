"use client";

interface User {
  id: string;
  name: string;
}

interface Props {
  users: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export default function AssigneePicker({
  users,
  selectedIds,
  onChange,
  disabled,
}: Props) {
  const allSelected = users.length > 0 && selectedIds.length === users.length;

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onChange(allSelected ? [] : users.map((u) => u.id));
  };

  if (users.length === 0) {
    return (
      <p className="text-xs text-red-400">לא נטענו משתמשים — רענן ונסה שוב.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {users.map((u) => {
        const active = selectedIds.includes(u.id);
        return (
          <button
            key={u.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(u.id)}
            className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors disabled:opacity-50 ${
              active
                ? "bg-pink text-white border-pink"
                : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600"
            }`}
          >
            {u.name.split(" ")[0]}
          </button>
        );
      })}
      {users.length > 1 && (
        <button
          type="button"
          disabled={disabled}
          onClick={selectAll}
          className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors disabled:opacity-50 ${
            allSelected
              ? "bg-pink text-white border-pink"
              : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600"
          }`}
        >
          {allSelected ? "כולם נבחרו" : "כל הצוות"}
        </button>
      )}
    </div>
  );
}
