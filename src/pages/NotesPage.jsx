import React, { useEffect, useMemo, useState } from 'react';
import PageTreeItem from '../components/notes/PageTreeItem';
import { createNotePage, getNotePages, reorderNotePages } from '../services/api';

const buildTree = (pages) => {
  const byParent = new Map();

  for (const page of pages) {
    const key = page.parent_block_id ?? 'root';
    const existing = byParent.get(key) || [];
    existing.push({ ...page, children: [] });
    byParent.set(key, existing);
  }

  const sortByPosition = (items) => items.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

  const attachChildren = (parentKey) => {
    const children = sortByPosition(byParent.get(parentKey) || []);
    return children.map((child) => ({
      ...child,
      children: attachChildren(child.id),
    }));
  };

  return attachChildren('root');
};

const NotesPage = ({ workspaceSlug }) => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [activePageId, setActivePageId] = useState(null);
  const [newRootTitle, setNewRootTitle] = useState('');
  const [draggedId, setDraggedId] = useState(null);

  const loadPages = async () => {
    try {
      setLoading(true);
      const data = await getNotePages();
      setPages(data);
      if (data.length > 0 && !activePageId) {
        setActivePageId(data[0].id);
      }
    } catch {
      setError('Nie udało się pobrać stron notatek.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const tree = useMemo(() => buildTree(pages), [pages]);

  const recentPages = useMemo(
    () =>
      [...pages]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 8),
    [pages]
  );

  const activePage = pages.find((page) => page.id === activePageId) || null;

  const handleToggle = (id, forceExpand) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      const shouldExpand = typeof forceExpand === 'boolean' ? forceExpand : !next.has(id);
      if (shouldExpand) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleCreatePage = async (title, parentBlockId = null) => {
    const siblings = pages.filter((page) => page.parent_block_id === parentBlockId);
    const position = siblings.length;
    const created = await createNotePage({ title, parentBlockId, position });
    setPages((current) => [...current, created]);
    setActivePageId(created.id);
  };

  const handleCreateRoot = async (event) => {
    event.preventDefault();
    const trimmed = newRootTitle.trim();
    if (!trimmed) return;
    await handleCreatePage(trimmed, null);
    setNewRootTitle('');
  };

  const handleDrop = async (targetId) => {
    if (!draggedId || draggedId === targetId) return;

    const target = pages.find((page) => page.id === targetId);
    if (!target) return;

    const newParentId = target.parent_block_id;
    const siblings = pages
      .filter((page) => page.parent_block_id === newParentId && page.id !== draggedId)
      .sort((a, b) => a.position - b.position);

    const reordered = [];
    let inserted = false;

    for (const sibling of siblings) {
      if (!inserted && sibling.id === targetId) {
        reordered.push({ id: draggedId, parent_block_id: newParentId, position: reordered.length });
        inserted = true;
      }
      reordered.push({ id: sibling.id, parent_block_id: newParentId, position: reordered.length });
    }

    if (!inserted) {
      reordered.push({ id: draggedId, parent_block_id: newParentId, position: reordered.length });
    }

    setPages((current) =>
      current.map((page) => {
        const update = reordered.find((item) => item.id === page.id);
        return update
          ? {
              ...page,
              parent_block_id: update.parent_block_id,
              position: update.position,
            }
          : page;
      })
    );

    setDraggedId(null);

    try {
      await reorderNotePages(
        reordered.map((item) => ({
          id: item.id,
          parentBlockId: item.parent_block_id,
          position: item.position,
        }))
      );
    } catch {
      setError('Nie udało się zapisać nowej kolejności stron.');
      await loadPages();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[320px,1fr]">
        <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h1 className="text-lg font-semibold text-gray-800">Notatki • {workspaceSlug}</h1>
            <p className="text-sm text-gray-500">Drzewo stron</p>
          </div>

          <form onSubmit={handleCreateRoot} className="mb-4 flex gap-2">
            <input
              value={newRootTitle}
              onChange={(event) => setNewRootTitle(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Nowa strona"
            />
            <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">
              Dodaj
            </button>
          </form>

          <div className="space-y-1">
            {tree.map((node) => (
              <PageTreeItem
                key={node.id}
                node={node}
                expandedIds={expandedIds}
                activePageId={activePageId}
                onToggle={handleToggle}
                onSelect={setActivePageId}
                onCreateInline={handleCreatePage}
                onDragStart={setDraggedId}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </aside>

        <main className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {loading ? <p className="text-sm text-gray-500">Ładowanie notatek...</p> : null}
          {error ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}

          {activePage ? (
            <div className="mb-8 border-b border-gray-100 pb-6">
              <h2 className="text-xl font-semibold text-gray-800">{activePage.title}</h2>
              <p className="mt-2 text-sm text-gray-500">ID strony: {activePage.id}</p>
              <p className="mt-1 text-sm text-gray-500">
                Ostatnia edycja: {new Date(activePage.updated_at).toLocaleString('pl-PL')}
              </p>
            </div>
          ) : (
            <p className="mb-8 text-sm text-gray-500">Wybierz stronę z drzewa lub dodaj nową.</p>
          )}

          <section>
            <h3 className="mb-3 text-base font-semibold text-gray-800">Ostatnio edytowane strony</h3>
            <div className="space-y-2">
              {recentPages.length === 0 ? (
                <p className="text-sm text-gray-500">Brak stron do wyświetlenia.</p>
              ) : (
                recentPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setActivePageId(page.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-700">{page.title}</span>
                    <span className="text-xs text-gray-500">{new Date(page.updated_at).toLocaleDateString('pl-PL')}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default NotesPage;
