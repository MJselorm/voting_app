import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { apiRequest } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import type { Notification } from "./NotificationBell";
interface NoticeList { items: Notification[]; total: number }
export function NotificationsPage() {
 const client = useQueryClient(); const notices = useQuery({queryKey:["notifications","all"],queryFn:()=>apiRequest<NoticeList>("/api/v1/notifications?limit=50")});
 const markAll = useMutation({mutationFn:()=>apiRequest<void>("/api/v1/notifications/mark-all-read",{method:"POST"}),onSuccess:()=>void client.invalidateQueries({queryKey:["notifications"]})});
 const markRead = useMutation({mutationFn:(id:string)=>apiRequest<Notification>(`/api/v1/notifications/${id}/read`,{method:"PATCH"}),onSuccess:()=>void client.invalidateQueries({queryKey:["notifications"]})});
 return <section className="mx-auto max-w-3xl space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm text-muted-foreground">Updates about your UniVote activity.</p></div><Button variant="outline" size="sm" onClick={()=>markAll.mutate()} disabled={markAll.isPending}><CheckCheck className="h-4 w-4" />Mark all read</Button></div>{notices.isLoading ? <p className="text-sm text-muted-foreground">Loading notifications…</p> : notices.isError ? <p className="text-sm text-destructive">Could not load notifications.</p> : notices.data?.items.length ? <div className="space-y-2">{notices.data.items.map(n=><article key={n.id} className={`rounded-lg border p-4 ${n.read_at ? "bg-card" : "border-primary/30 bg-primary/5"}`}><div className="flex justify-between gap-4"><div><h2 className="font-semibold">{n.title}</h2><p className="mt-1 text-sm text-muted-foreground">{n.body}</p><time className="mt-2 block text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</time></div>{!n.read_at&&<Button variant="ghost" size="sm" onClick={()=>markRead.mutate(n.id)}>Mark read</Button>}</div></article>)}</div> : <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground"><Bell className="mx-auto mb-3 h-7 w-7" />No notifications yet.</div>}</section>
}
