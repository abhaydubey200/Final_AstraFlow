import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabaseUntyped as supabase } from "@/integrations/supabase/untyped-client";
import { useAuth } from "@/components/AuthProvider";

export interface Notification {
  id: string;
  user_id: string;
  alert_rule_id: string | null;
  pipeline_id: string | null;
  run_id: string | null;
  title: string;
  message: string;
  severity: string;
  read: boolean;
  created_at: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  pipeline_id: string | null;
  rule_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_by: string | null;
  notify_email: string | null;
  created_at: string;
  updated_at: string;
}

const NOTIFICATIONS_KEY = ["notifications"];
const ALERT_RULES_KEY = ["alert_rules"];

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<Notification[]>({
    queryKey: NOTIFICATIONS_KEY,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as Notification[]) ?? [];
    },
  });

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return query;
}

export function useUnreadCount() {
  const { data: notifications } = useNotifications();
  return notifications?.filter((n) => !n.read).length ?? 0;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useMarkAllRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useAlertRules() {
  return useQuery<AlertRule[]>({
    queryKey: ALERT_RULES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as AlertRule[]) ?? [];
    },
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<AlertRule, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("alert_rules")
        .insert(rule)
        .select()
        .single();
      if (error) throw error;
      return data as AlertRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ALERT_RULES_KEY }),
  });
}

export function useToggleAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("alert_rules")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ALERT_RULES_KEY }),
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alert_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ALERT_RULES_KEY }),
  });
}
