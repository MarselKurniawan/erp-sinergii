import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  title: string;
  icon?: React.ReactNode;
  from: string; to: string;
  setFrom: (v: string) => void; setTo: (v: string) => void;
  children: React.ReactNode;
  extra?: React.ReactNode;
}

export const ReportShell: React.FC<Props> = ({ title, icon, from, to, setFrom, setTo, children, extra }) => (
  <div className="p-6 space-y-4">
    <h1 className="text-2xl font-bold flex items-center gap-2">{icon}{title}</h1>
    <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
      <div><Label>Dari</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div><Label>Sampai</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {extra}
    </CardContent></Card>
    <Card><CardContent className="p-4">{children}</CardContent></Card>
  </div>
);

export const defaultRange = () => {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return { from: d.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
};