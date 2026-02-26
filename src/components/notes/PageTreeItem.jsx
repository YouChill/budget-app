import React, { useState } from 'react';

const Chevron = ({ expanded }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const PageTreeItem = ({
  node,
  depth = 0,
  expandedIds,
  activePageId,
  onToggle,
  onSelect,
  onCreateInline,
  onDragStart,
  onDrop,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [showInlineForm, setShowInlineForm] = useState(false);
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;

  const handleCreate = async (event) => {
    event.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    await onCreateInline(trimmed, node.id);
    setNewTitle('');
    setShowInlineForm(false);
    onToggle(node.id, true);
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg px-2 py-1 text-sm ${
          activePageId === node.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        draggable
        onDragStart={() => onDragStart(node.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onDrop(node.id)}
      >
        <button
          type="button"
          className="h-5 w-5 shrink-0 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-0"
          onClick={() => onToggle(node.id)}
          disabled={!hasChildren}
        >
          {hasChildren ? <Chevron expanded={isExpanded} /> : null}
        </button>

        <button type="button" className="flex-1 truncate text-left" onClick={() => onSelect(node.id)}>
          {node.title || 'Bez tytułu'}
        </button>

        <button
          type="button"
          className="invisible rounded px-1 text-xs text-gray-500 hover:bg-gray-200 group-hover:visible"
          onClick={() => setShowInlineForm((value) => !value)}
        >
          +
        </button>
      </div>

      {showInlineForm ? (
        <form onSubmit={handleCreate} className="mt-1 flex gap-2" style={{ paddingLeft: `${depth * 14 + 30}px` }}>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
            placeholder="Nazwa podstrony"
            autoFocus
          />
          <button type="submit" className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">
            OK
          </button>
        </form>
      ) : null}

      {isExpanded
        ? node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              activePageId={activePageId}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateInline={onCreateInline}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))
        : null}
    </div>
  );
};

export default PageTreeItem;
