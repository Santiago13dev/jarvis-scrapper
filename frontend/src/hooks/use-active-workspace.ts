"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Workspace } from "@/types/api";

const STORAGE_KEY = "jarvisia_workspace_id";

/**
 * Resuelve el workspace activo: lo lee de localStorage si ya fue elegido, o
 * carga los workspaces de la organización y toma el primero por defecto.
 * Devuelve `null` mientras carga, y `undefined` si no hay ninguno (organización
 * recién creada sin workspaces todavía).
 */
export function useActiveWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await api.get<Workspace[]>("/users/me/workspaces");
        if (cancelled) return;
        setWorkspaces(result);

        const stored = window.localStorage.getItem(STORAGE_KEY);
        const stillValid = stored && result.some((w) => w.id === stored);
        const resolved = stillValid ? stored : (result[0]?.id ?? null);

        if (resolved) window.localStorage.setItem(STORAGE_KEY, resolved);
        setWorkspaceId(resolved);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectWorkspace(id: string) {
    window.localStorage.setItem(STORAGE_KEY, id);
    setWorkspaceId(id);
  }

  return { workspaces, workspaceId, selectWorkspace, loading, error };
}
