import { Bell } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";

export interface Notification { id: string; title: string; body: string; action_url: string | null; read_at: string | null; created_at: string }
interface NoticeList { items: Notification[]; total: number }

export function NotificationBell() {
  const client = useQueryClient(); const navigate = useNavigate();
  const count = useQuery({ queryKey: ["notifications", "count"], queryFn: () => apiRequest<{ count: number }>("/api/v1/notifications/unread-count"), refetchInterval: 30000 });
  const recent = useQuery({ queryKey: ["notifications", "recent"], queryFn: () => apiRequest<NoticeList>("/api/v1/notifications?limit=5") });
  const read = useMutation({ mutationFn: (id: string) => apiRequest<Notification>(`/api/v1/notifications/${id}/read`, { method: "PATCH" }), onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications"] }) });
  const open = (notice: Notification) => { if (!notice.read_at) read.mutate(notice.id); if (notice.action_url) navigate(notice.action_url); };
  return <DropdownMenu><DropdownMenuTrigger><Button variant="ghost" size="icon" className="relative" aria-label="Notifications"><Bell className="h-4 w-4" />{(count.data?.count ?? 0) > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-[9px] leading-4 text-destructive-foreground">{count.data?.count}</span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80"><DropdownMenuLabel>Notifications</DropdownMenuLabel><DropdownMenuSeparator />{recent.isLoading ? <p className="p-3 text-xs text-muted-foreground">Loading notifications…</p> : recent.data?.items.length ? recent.data.items.map((n) => <DropdownMenuItem key={n.id} onClick={() => open(n)} className={!n.read_at ? "bg-primary/5" : ""}><div className="min-w-0 py-1"><p className="truncate font-semibold">{n.title}</p><p className="line-clamp-2 text-muted-foreground">{n.body}</p></div></DropdownMenuItem>) : <p className="p-3 text-xs text-muted-foreground">You have no notifications.</p>}<DropdownMenuSeparator /><DropdownMenuItem onClick={() => navigate("/app/notifications")}>View all notifications</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
