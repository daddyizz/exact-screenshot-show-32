import { Bell, CheckCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationCenter({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", userId], enabled: Boolean(userId), refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_notifications" as any).select("*").order("created_at", { ascending: false }).limit(20);
      if (error) {
        const msg = String(error.message).toLowerCase();
        if (msg.includes("user_notifications") || msg.includes("schema cache") || msg.includes("does not exist")) return [] as any[];
        throw error;
      }
      return (data ?? []) as any[];
    },
  });
  const rows = query.data ?? []; const unread = rows.filter((n) => !n.read_at).length;
  const markAll = useMutation({ mutationFn: async () => { const ids = rows.filter((n) => !n.read_at).map((n) => n.id); if (!ids.length) return; const { error } = await supabase.from("user_notifications" as any).update({ read_at: new Date().toISOString() }).in("id", ids); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }) });

  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label="Notifications"><Bell aria-hidden />{unread > 0 ? <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread > 9 ? "9+" : unread}</span> : null}</Button></PopoverTrigger>
    <PopoverContent align="end" className="w-[min(92vw,380px)] p-0"><div className="flex items-center justify-between border-b p-4"><div><p className="font-semibold">Notifications</p><p className="text-xs text-muted-foreground">{unread ? `${unread} unread` : "You're all caught up"}</p></div>{unread ? <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}><CheckCheck className="size-4" aria-hidden />Mark read</Button> : null}</div>
      <div className="max-h-[420px] overflow-y-auto">{rows.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</p> : rows.map((n) => <div key={n.id} className={`border-b p-4 last:border-0 ${!n.read_at ? "bg-muted/40" : ""}`}><div className="flex items-start gap-2"><span className={`mt-1 size-2 shrink-0 rounded-full ${n.severity === "error" ? "bg-destructive" : n.severity === "warning" ? "bg-amber-500" : "bg-primary"}`} /><div className="min-w-0"><p className="text-sm font-medium">{n.title}</p><p className="mt-1 text-xs text-muted-foreground">{n.message}</p><div className="mt-2 flex items-center gap-3"><span className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>{n.action_url ? <Link to={n.action_url as any} className="text-xs font-medium text-primary">{n.action_label || "Open"}</Link> : null}</div></div></div></div>)}</div>
    </PopoverContent></Popover>;
}
