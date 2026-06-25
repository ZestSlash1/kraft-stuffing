import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { fromDbContainer, fromDbLine } from "./db";

// One Supabase Realtime channel per voyage: container/line postgres_changes +
// presence (who is actively logging which container right now).
// `containerIds` should be the live list of container ids for this voyage (from
// app state) so stuffing_lines events can be filtered without an extra fetch.
// Returns { presence, track } — presence is userId -> {userId, displayName, containerId, lastSeen}.
export function useVoyageRealtime(voyageId, dispatch, containerIds = []) {
  const channelRef = useRef(null);
  const containerIdsRef = useRef(new Set());
  const [presence, setPresence] = useState({});

  // Keep the filter set current as containers are added/removed locally.
  useEffect(() => {
    containerIdsRef.current = new Set(containerIds);
  }, [containerIds]);

  useEffect(() => {
    if (!voyageId) return;

    const channel = supabase.channel(`voyage:${voyageId}`);
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "containers", filter: `voyage_id=eq.${voyageId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const container = fromDbContainer(payload.new);
            containerIdsRef.current.add(container.id);
            dispatch({ type: "ADD_CONTAINER", voyageId, container });
          } else if (payload.eventType === "UPDATE") {
            const container = fromDbContainer(payload.new);
            dispatch({
              type: "UPDATE_CONTAINER",
              voyageId,
              containerId: container.id,
              patch: container,
            });
          } else if (payload.eventType === "DELETE") {
            const id = payload.old.id;
            containerIdsRef.current.delete(id);
            dispatch({ type: "REMOVE_CONTAINER", voyageId, containerId: id });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stuffing_lines" },
        (payload) => {
          const row = payload.new;
          if (!containerIdsRef.current.has(row.container_id)) return;
          const line = fromDbLine(row);
          dispatch({
            type: "ADD_LINE",
            voyageId,
            containerId: line.containerId,
            line,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "stuffing_lines" },
        (payload) => {
          const row = payload.old;
          if (!containerIdsRef.current.has(row.container_id)) return;
          dispatch({
            type: "REMOVE_LINE",
            voyageId,
            containerId: row.container_id,
            lineId: row.id,
          });
        }
      )
      .on("presence", { event: "sync" }, () => {
        const flat = flattenPresence(channel);
        setPresence(flat);
        dispatch({ type: "SET_PRESENCE", presence: flat });
      })
      .on("presence", { event: "join" }, () => {
        const flat = flattenPresence(channel);
        setPresence(flat);
        dispatch({ type: "SET_PRESENCE", presence: flat });
      })
      .on("presence", { event: "leave" }, () => {
        const flat = flattenPresence(channel);
        setPresence(flat);
        dispatch({ type: "SET_PRESENCE", presence: flat });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      containerIdsRef.current = new Set();
      setPresence({});
    };
  }, [voyageId, dispatch]);

  const track = useCallback((payload) => {
    channelRef.current?.track({ ...payload, lastSeen: Date.now() });
  }, []);

  return { presence, track };
}

function flattenPresence(channel) {
  const state = channel.presenceState();
  const out = {};
  for (const key in state) {
    const entry = state[key][state[key].length - 1];
    out[key] = entry;
  }
  return out;
}
