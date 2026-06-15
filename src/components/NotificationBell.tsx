import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface Notif { id: string; title: string; message: string | null; link: string | null; read_at: string | null; created_at: string; type: string; }

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from('notifications').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      setItems((data || []) as Notif[]);
    };
    void load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [user?.id]);

  const unread = items.filter(i => !i.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id).is('read_at', null);
    setItems(items.map(i => ({ ...i, read_at: i.read_at || new Date().toISOString() })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unread > 0 && <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs">{unread}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold">Notifikasi</div>
          {unread > 0 && <Button size="sm" variant="ghost" onClick={markAllRead}>Tandai dibaca</Button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Tidak ada notifikasi</div>}
          {items.map(n => (
            <Link key={n.id} to={n.link || '#'} className={`block p-3 border-b hover:bg-muted/50 ${!n.read_at ? 'bg-primary/5' : ''}`}>
              <div className="font-medium text-sm">{n.title}</div>
              {n.message && <div className="text-xs text-muted-foreground mt-1">{n.message}</div>}
              <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('id-ID')}</div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};