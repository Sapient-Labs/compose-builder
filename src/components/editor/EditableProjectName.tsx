import { useEffect, useRef, useState } from 'react';
import { useLaunchpadStore } from '@/lib/state/store';
import { DEFAULT_PROJECT_NAME } from '@/lib/state/workspace';

export function EditableProjectName() {
  const { activeProject, updateProject } = useLaunchpadStore();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(activeProject?.name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftName(activeProject?.name ?? '');
    }
  }, [activeProject?.id, activeProject?.name, isEditing]);

  useEffect(() => {
    if (isEditing && measureRef.current && inputRef.current) {
      inputRef.current.style.width = `${measureRef.current.offsetWidth + 28}px`;
    }
  }, [draftName, isEditing]);

  const save = () => {
    const name = draftName.trim() || DEFAULT_PROJECT_NAME;
    setDraftName(name);
    if (name !== activeProject?.name) updateProject({ name });
  };

  return (
    <div
      className="relative min-w-0"
      onMouseEnter={() => setIsEditing(true)}
      onMouseLeave={() => {
        if (document.activeElement !== inputRef.current) {
          setIsEditing(false);
        }
      }}
    >
      <span
        ref={measureRef}
        className="invisible absolute top-0 left-0 whitespace-pre text-md font-semibold"
        aria-hidden="true"
      >
        {draftName || ' '}
      </span>
      {isEditing ? (
        <input
          ref={inputRef}
          value={draftName}
          maxLength={40}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            save();
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraftName(activeProject?.name ?? '');
              setIsEditing(false);
            }
          }}
          className="border-border bg-transparent px-3 py-1 text-md font-semibold outline-none border rounded-md focus:border-foreground transition-all duration-200 animate-in fade-in zoom-in-95"
          aria-label="Project name"
        />
      ) : (
        <h1 className="text-md font-semibold truncate px-3 py-1 border border-transparent rounded-md transition-all duration-200 animate-in fade-in zoom-in-95">
          {activeProject?.name ?? DEFAULT_PROJECT_NAME}
        </h1>
      )}
    </div>
  );
}
