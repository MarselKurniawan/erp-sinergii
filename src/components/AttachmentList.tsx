import React, { useEffect, useState, useRef } from 'react';
import { Paperclip, Upload, Trash2, FileText, Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

interface Props {
  entityType: string;
  entityId: string;
}

export const AttachmentList: React.FC<Props> = ({ entityType, entityId }) => {
  const { selectedCompany } = useCompany();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (entityId) void load(); /* eslint-disable-next-line */ }, [entityId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('transaction_attachments')
      .select('*').eq('entity_type', entityType).eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    setItems((data || []) as Attachment[]);
    setLoading(false);
  };

  const handleUpload = async (file: File) => {
    if (!selectedCompany) return;
    setUploading(true);
    try {
      const path = `${selectedCompany.id}/${entityType}/${entityId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('transaction-attachments').upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('transaction_attachments').insert({
        company_id: selectedCompany.id, entity_type: entityType, entity_id: entityId,
        file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (insErr) throw insErr;
      toast.success('Lampiran berhasil diupload');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Gagal upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from('transaction-attachments').createSignedUrl(att.file_path, 60);
    if (error || !data) { toast.error('Gagal membuat link'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Hapus lampiran "${att.file_name}"?`)) return;
    await supabase.storage.from('transaction-attachments').remove([att.file_path]);
    await supabase.from('transaction_attachments').delete().eq('id', att.id);
    toast.success('Lampiran dihapus');
    void load();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium"><Paperclip className="w-4 h-4" />Lampiran ({items.length})</div>
        <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          Upload
        </Button>
        <input ref={inputRef} type="file" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      </div>
      {loading ? <div className="text-xs text-muted-foreground">Memuat...</div> : (
        <div className="space-y-1">
          {items.length === 0 && <div className="text-xs text-muted-foreground italic">Belum ada lampiran</div>}
          {items.map(att => (
            <div key={att.id} className="flex items-center gap-2 rounded border p-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 truncate">{att.file_name}</span>
              <span className="text-xs text-muted-foreground">{att.size_bytes ? `${(att.size_bytes/1024).toFixed(1)} KB` : ''}</span>
              <Button size="icon" variant="ghost" onClick={() => handleDownload(att)}><Download className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(att)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};