"use client";

import { useEffect, useRef, useState, useTransition } from 'react';
import { Copy, FolderOpen, Loader2 } from 'lucide-react';
import { getLibraryScriptsAction, loadLibraryScriptAction } from '@/app/actions/library-script-actions';
import type { LibraryScriptSummary, LoadedLibraryScript } from '@/lib/media/scripts';

const fieldClass = 'w-full rounded-xl border border-border bg-background/50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

export function MediaLibraryScriptPicker({ id, disabled = false, maxCharacters, onLoad }: {
  id: string;
  disabled?: boolean;
  maxCharacters: number;
  onLoad: (script: LoadedLibraryScript) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scripts, setScripts] = useState<LibraryScriptSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [selected, setSelected] = useState<LoadedLibraryScript | null>(null);
  const [loading, setLoading] = useState<'library' | 'script' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const requestId = useRef({ value: 0 });
  const mounted = useRef(true);

  useEffect(() => {
    const requests = requestId.current;
    mounted.current = true;
    return () => { mounted.current = false; requests.value++; };
  }, []);

  const close = () => {
    requestId.current.value++;
    setOpen(false);
    setLoading(null);
  };

  const browse = () => {
    if (open) { close(); return; }
    const request = ++requestId.current.value;
    setOpen(true);
    setLoading('library');
    setError(null);
    setSearch('');
    setScripts([]);
    setSelected(null);
    setSelectedKey('');
    startTransition(async () => {
      try {
        const result = await getLibraryScriptsAction();
        if (!mounted.current || request !== requestId.current.value) return;
        if (!result.success) throw new Error(result.error);
        setScripts(result.scripts);
      } catch (failure) {
        if (mounted.current && request === requestId.current.value) setError(failure instanceof Error ? failure.message : 'Could not load library scripts. Try opening the picker again.');
      } finally {
        if (mounted.current && request === requestId.current.value) setLoading(null);
      }
    });
  };

  const select = (key: string) => {
    const request = ++requestId.current.value;
    setSelectedKey(key);
    setSelected(null);
    setError(null);
    setLoading(key ? 'script' : null);
    if (!key) return;
    startTransition(async () => {
      try {
        const result = await loadLibraryScriptAction(key);
        if (!mounted.current || request !== requestId.current.value) return;
        if (!result.success) throw new Error(result.error);
        setSelected(result.script);
      } catch (failure) {
        if (mounted.current && request === requestId.current.value) setError(failure instanceof Error ? failure.message : 'Could not load this script. Choose another library item.');
      } finally {
        if (mounted.current && request === requestId.current.value) setLoading(null);
      }
    });
  };

  const filtered = scripts.filter(item => `${item.title} ${item.source}`.toLowerCase().includes(search.trim().toLowerCase()));
  const tooLong = selected !== null && selected.text.length > maxCharacters;

  return (
    <div className="space-y-3">
      <button type="button" onClick={browse} disabled={disabled} aria-expanded={open} aria-controls={`${id}-panel`} className={buttonClass}>
        <FolderOpen className="h-4 w-4" /> {open ? 'Close library picker' : 'Copy script from Media Library'}
      </button>
      {open && <div id={`${id}-panel`} className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">Choose a saved lesson, script, or audio transcript. Preview it before replacing the editor text.</p>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {loading === 'library' ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading library scripts…</p>
          : scripts.length === 0 && !error ? <p role="status" className="text-sm text-muted-foreground">No reusable scripts yet. Save a lesson or script in your Media Library first.</p>
          : scripts.length > 0 && <>
            <div><label htmlFor={`${id}-search`} className="mb-2 block text-sm font-medium">Search library scripts</label><input id={`${id}-search`} type="search" value={search} maxLength={150} disabled={disabled} onChange={event => { setSearch(event.target.value); select(''); }} placeholder="Search by title or type" className={fieldClass} /></div>
            <div><label htmlFor={`${id}-selection`} className="mb-2 block text-sm font-medium">Saved library script</label><select id={`${id}-selection`} value={selectedKey} disabled={disabled} onChange={event => select(event.target.value)} className={fieldClass}>
              <option value="">Choose a library item</option>
              {filtered.map(item => <option key={item.key} value={item.key}>{item.source} · {item.title}</option>)}
            </select>{filtered.length === 0 && <p role="status" className="mt-2 text-sm text-muted-foreground">No scripts match this search.</p>}</div>
          </>}
        {loading === 'script' && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading selected script…</p>}
        {selected && <>
          <div><label htmlFor={`${id}-preview`} className="mb-2 block text-sm font-medium">Script preview</label><textarea id={`${id}-preview`} readOnly value={selected.text} rows={5} className={`${fieldClass} resize-y`} /></div>
          <p className="text-xs text-muted-foreground">{selected.text.length.toLocaleString()} characters{tooLong ? `. This editor accepts ${maxCharacters.toLocaleString()}; only the first ${maxCharacters.toLocaleString()} will be copied.` : '. Copying replaces your current script.'}</p>
          <button type="button" disabled={disabled || loading !== null} onClick={() => {
            onLoad({ title: selected.title, text: selected.text.slice(0, maxCharacters) });
            close();
          }} className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`}>
            <Copy className="h-4 w-4" /> {tooLong ? `Copy first ${maxCharacters.toLocaleString()} characters` : 'Copy to editor'}
          </button>
        </>}
      </div>}
    </div>
  );
}
